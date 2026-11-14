'use strict';
/* 会话状态机纯核心 (js/town-dialog-core.js) 可执行规格 — node --test (零依赖)
   运行: node --test test/town-dialog-core.test.js
   T-UI-04 红测(票: .scratch/handoffs/2026-11-13-T-UI-04-dispatch-brief.md; 操作性规格:
   docs/design/town-ui-dialog-prebuild.md §5 函数面+§5.3 断言面+§6 B1-B8 参数表;
   设计权威: docs/design/town-ui-dialog-spec.md §5 九态状态图/§2.2 接口/§6 选项/
   §7 表扬分工; 会话五值域权威=js/town-interact-core.js TOWN_SESSION_KINDS,
   本核心对 sessionKind 只透传不校验(零第二权威))。只测票文要的外显行为,
   全走公共 seam(冻结常量+工厂+纯派生函数)。红期 js/town-dialog-core.js 缺席全红。
   偏离登记(prebuild §5.2 草案→实现定稿): ① mkDialogMachine 不收 now()——conventions
   -core 契约零墙钟(先例 mkTownTargets 签名不含 now), praise 停留节奏归装配层 timer;
   ② dialogEventsFor 未单列成函数——事件派发内联进 mkDialogMachine.handle(职责
   折叠, 功能等价; close 三值(deferred|done|continue)路由由 (from, intent) 在
   handle 内共同决定, prebuild §2.3 表; 登记文本更正 2026-11-14, 原记「增第 4 参
   intentType」与实现不符);
   ③ 意图词表增 confirm(respond→praise 桥接, 矩阵行「确认即入 praise」), 裁 replay
   不进机器(§6.2 重播不改变状态, 装配层 TTS 直执行)。 */
const test = require('node:test');
const assert = require('node:assert');

let core = null;
try {
  core = require('../js/town-dialog-core.js');
} catch {
  core = null;
}

/* ---------- 装具: 会话条目(形状=T-SEAM-04 townInteractRegistry 快照同形) ---------- */
function entryOf(overrides) {
  return Object.assign({
    id: 'task:find-bread',
    kind: 'task',
    iconKey: 'find',
    label: '找面包',
    anchor: {x: 100, y: 24, z: 100},
    state: 'active',
    sessionKind: 'seek',
    taskRef: 'task:find-bread',
  }, overrides || {});
}

/* 开一个 seek 会话的便捷机: click-npc→route 两步 */
function mkSeekMachine(emit) {
  const m = core.mkDialogMachine({emit: emit || (() => {})});
  m.handle({type: 'click-npc', payload: {entry: entryOf()}});
  m.handle({type: 'route'});
  return m;
}

/* ============================================================
   ① 冻结常量面: 九态/意图/转移表/参数表(B1-B8+TTS 仲裁)
   ============================================================ */

test('常量冻结面: DIALOG_STATES 恰九值小写 id; DIALOG_INTENTS/DIALOG_TRANSITIONS/DIALOG_OPTS 冻结', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  assert.deepStrictEqual([...core.DIALOG_STATES],
      ['idle', 'bubble', 'greet', 'guide', 'seek', 'help', 'respond', 'praise', 'complete'],
      '九态小写 id(dialog-prebuild §2.1 归一口径)');
  assert.ok(Object.isFrozen(core.DIALOG_STATES), '状态集冻结');
  assert.ok(Object.isFrozen(core.DIALOG_INTENTS), '意图集冻结');
  assert.ok(Object.isFrozen(core.DIALOG_TRANSITIONS), '转移表冻结');
  assert.ok(Object.isFrozen(core.DIALOG_OPTS), '参数表冻结');
  /* 意图词表: prebuild §2.2 草案 10 + confirm(实现定稿; replay 不进机器) */
  assert.deepStrictEqual([...core.DIALOG_INTENTS].sort(),
      ['blur', 'click-npc', 'confirm', 'continue-explore', 'defer', 'end', 'focus',
        'next-step', 'pick-option', 'route', 'target-found'].sort(),
      '意图词表定稿(prebuild §2.2 + confirm)');
});

test('B1-B8 参数表落点显式(DIALOG_OPTS 逐键断言, prebuild §6 总表)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const o = core.DIALOG_OPTS;
  assert.strictEqual(o.panelAnchor, 'bottom-center', 'B1 Panel 锚位=底部居中');
  assert.strictEqual(o.ambientBubbles, false, 'B2 背景 NPC 闲聊 bubble 默认关闭');
  assert.strictEqual(o.maxOptionsPerStep, 3, 'B3 每步 ≤3 选项');
  assert.strictEqual(o.allowNestedChoice, false, 'B3 无二级嵌套');
  assert.strictEqual(o.ttsAutoPerStep, 'once', 'B4 每步自动播一次');
  assert.strictEqual(o.ttsRespectMute, true, 'B4 遵循系统静音');
  assert.deepStrictEqual(o.closeAffordance, {label: '稍后', icon: 'wave-bye'},
      'B5 关闭语义=「稍后」/挥手再见(不出现「退出任务」压力词)');
  assert.strictEqual(o.seekTargetThumb, 'persistent', 'B6 Seek 目标缩略图常驻');
  assert.strictEqual(o.golemCareSession, 'light', 'B7 铁傀儡关怀首版=轻交互');
  assert.strictEqual(o.praiseSharedComponent, true, 'B8 与 A 反馈构件同源复用');
  assert.strictEqual(o.praiseSessionCompact, true, 'B8 会话内更紧凑');
  /* N 系与表扬节奏参数(dialog-spec §5.4/§7.1; prebuild §8 N3) */
  assert.strictEqual(o.praiseAutoAdvance, true, 'N3 praise 后 dwell 自动步进');
  assert.strictEqual(o.badgesMax, 3, '会话内徽章累积 1-3 枚(§7.1)');
  assert.strictEqual(o.praiseInMs, 180, '徽章弹入 180ms(§5.4)');
  assert.strictEqual(o.praiseDwellMinMs, 800, '徽章停留 ≥800ms(§5.4)');
  assert.deepStrictEqual([...o.praiseTotalMs], [1200, 2000], '表扬总时长 1.2-2.0s(§4.2)');
});

test('TTS 仲裁参数面(prebuild §4.2 优先级表+仲裁规则参数显式)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  assert.deepStrictEqual({...core.TTS_PRIORITIES},
      {ambient: 0, aTask: 2, step: 4, praise: 4, replay: 5},
      '五级优先级表: P0 氛围/P2 A 任务/P4 步进=表扬/P5 手动重播');
  const o = core.DIALOG_OPTS;
  assert.strictEqual(o.ttsPreempt, 'higher-only', '新句严格更高优先级才抢占');
  assert.strictEqual(o.ttsQueueMax, 2, '队列上限 2');
  assert.strictEqual(o.ttsSuppressAInSession, true, '会话中抑制 A 侧自动播报');
  assert.strictEqual(o.ttsDebounceSameMs, 800, '同句 800ms 内不重复触发');
});

/* ============================================================
   ② 转移表: 与 dialog-spec §5.2 状态图逐边一一对应(§5.3 断言 1)
   ============================================================ */

test('转移表逐边: §5.2 状态图每条边在 DIALOG_TRANSITIONS 可寻; 图外组合不可寻', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const T = core.DIALOG_TRANSITIONS;
  const edge = (from, intent, expect) => {
    assert.deepStrictEqual(T[from] && T[from][intent], expect,
        '边 ' + from + ' --' + intent + '--> ' + JSON.stringify(expect));
  };
  /* 图边(小写 id 归一; close 类边=矩阵行「关闭/稍后」细化, 登记于测试头) */
  edge('idle', 'focus', 'bubble'); /* Idle --> BubbleHint: 靠近/可交互焦点 */
  edge('bubble', 'blur', 'idle'); /* BubbleHint --> Idle: 移开焦点 */
  edge('bubble', 'click-npc', 'greet'); /* BubbleHint --> Greet: 点击 NPC */
  edge('greet', 'route', ['guide', 'seek', 'help']); /* Greet --> Guide|Seek|Help */
  edge('greet', 'defer', 'idle'); /* Greet --> [*]: 关闭/稍后 */
  edge('greet', 'end', 'idle'); /* 轻问候直接结束(矩阵 greet 行) */
  edge('greet', 'pick-option', 'idle'); /* 挥手回应收尾=轻问候 L1 路径 */
  edge('guide', 'pick-option', 'respond'); /* Guide --> Respond: 玩家点选/查看 */
  edge('guide', 'defer', 'idle'); /* Guide --> [*] */
  edge('seek', 'target-found', 'respond'); /* Seek --> Respond: 找到并点选目标 */
  edge('seek', 'defer', 'idle'); /* Seek --> [*] */
  edge('help', 'pick-option', 'respond'); /* Help --> Respond: 完成帮助动作 */
  edge('help', 'defer', 'idle'); /* Help --> [*] */
  edge('respond', 'confirm', 'praise'); /* Respond --> Praise(矩阵: 确认即入 praise) */
  edge('respond', 'defer', 'idle'); /* respond 出口照常可点(矩阵行) */
  edge('praise', 'next-step', ['guide', 'seek', 'help', 'complete']);
  /* Praise --> Guide: 还有下一小步 | Praise --> Complete: 本轮完成 */
  edge('praise', 'defer', 'idle'); /* Praise --> [*] */
  edge('complete', 'end', 'idle'); /* Complete --> [*]: 自然结束 */
  edge('complete', 'continue-explore', 'idle'); /* 继续看看(矩阵 complete 行) */
  /* 图外组合不可寻(非法意图安全面由 machine.handle 承担) */
  assert.strictEqual(T.idle && T.idle['click-npc'], undefined, '图外边不可寻');
  assert.strictEqual(T.complete && T.complete['defer'], undefined,
      'complete 已是出口态, 无 defer 边');
  assert.strictEqual(T.bubble && T.bubble['focus'], undefined, 'bubble 无自环');
});

/* ============================================================
   ③ machine: 初始态/返回形状/非法意图零惩罚(§5.3 断言 2)
   ============================================================ */

test('mkDialogMachine: 初始 idle; snapshot 形状九键; 非法意图零抛零变零事件', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const m = core.mkDialogMachine({emit: () => {}});
  assert.strictEqual(m.state(), 'idle', '初始 Idle');
  const snap = m.snapshot();
  assert.deepStrictEqual(Object.keys(snap).sort(),
      ['badges', 'canClose', 'hasPendingChoice', 'npcId', 'sessionKind', 'stepN',
        'targetIconId', 'taskRef', 'state'].sort(),
      'snapshot 形状(prebuild §5.2: state/npcId/sessionKind/taskRef/stepN/badges/' +
      'canClose/hasPendingChoice/targetIconId)');
  assert.strictEqual(snap.canClose, true, '无压力出口恒可关(§6.2 canClose 恒 true)');
  /* 非法意图: idle 下 pick-option/end/defer 全部零惩罚拒绝 */
  for (const bad of ['pick-option', 'end', 'defer', 'route', 'target-found',
    'confirm', 'next-step', 'continue-explore', 'blur']) {
    const out = m.handle({type: bad, payload: {}});
    assert.deepStrictEqual(out, {changed: false, events: []},
        'idle 下非法意图「' + bad + '」→零惩罚拒绝');
    assert.strictEqual(m.state(), 'idle', '状态不变');
  }
});

/* ============================================================
   ④ bubble 边零 dialog 事件(§5.3 断言 5: A 不收敛)
   ============================================================ */

test('bubble 边零 dialog 事件: idle↔bubble 往返不发 open/close/update(局部提示不触发 A 收敛)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const fired = [];
  const m = core.mkDialogMachine({emit: (n, p) => fired.push({name: n, payload: p})});
  const up = m.handle({type: 'focus', payload: {entry: entryOf({sessionKind: undefined,
    taskRef: undefined, id: 'bell-tower', kind: 'landmark', label: '钟塔'})}});
  assert.strictEqual(up.changed, true, 'focus 进 bubble');
  assert.strictEqual(m.state(), 'bubble', 'BubbleHint 态');
  const down = m.handle({type: 'blur'});
  assert.strictEqual(down.changed, true, 'blur 回 idle');
  assert.strictEqual(m.state(), 'idle', '回 Idle');
  assert.deepStrictEqual(fired, [], '往返零 town-ui/dialog/* 事件(A 不收敛, prebuild §1.3)');
});

/* ============================================================
   ⑤ open 恰发一次(§5.3 断言 3)
   ============================================================ */

test('open 恰发一次: click-npc 进 greet 发 open{npcId,anchor,sessionKind,taskRef}+update; 重复不重发', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const fired = [];
  const m = core.mkDialogMachine({emit: (n, p) => fired.push({name: n, payload: p})});
  m.handle({type: 'click-npc', payload: {entry: entryOf()}});
  assert.strictEqual(m.state(), 'greet', '进 Greet');
  assert.strictEqual(fired.length, 2, '恰两条: open+update{step:greet}(矩阵 greet 行)');
  assert.strictEqual(fired[0].name, 'town-ui/dialog/open', 'open 恰一次');
  assert.deepStrictEqual(fired[0].payload,
      {npcId: 'task:find-bread', anchor: {x: 100, y: 24, z: 100},
        sessionKind: 'seek', taskRef: 'task:find-bread'},
      'open payload 形状(dialog-spec §2.2)');
  assert.strictEqual(fired[1].name, 'town-ui/dialog/update', '随行 update');
  assert.deepStrictEqual(fired[1].payload,
      {step: 'greet', canClose: true, hasPendingChoice: false},
      'update payload: step+canClose 恒 true+hasPendingChoice');
  /* 重复 click-npc/focus 不重发 open(prebuild §2.2「open 恰发一次」) */
  fired.length = 0;
  m.handle({type: 'click-npc', payload: {entry: entryOf()}});
  m.handle({type: 'focus', payload: {entry: entryOf()}});
  assert.deepStrictEqual(fired, [], '会话中重复意图零事件(open 不重发)');
  assert.strictEqual(m.state(), 'greet', '状态不变');
});

/* ============================================================
   ⑥ route 分路: sessionKind 驱动 guide|seek|help(§2.2 矩阵)
   ============================================================ */

test('route 分路: sessionKind 映射 tour→guide/seek→seek/help→help; update 携 intent 词', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const cases = [
    ['tour', 'guide', 'tour'],
    ['seek', 'seek', 'find'],
    ['help', 'help', 'give'],
  ];
  for (const [kind, wantState, wantIntent] of cases) {
    const fired = [];
    const m = core.mkDialogMachine({emit: (n, p) => fired.push({name: n, payload: p})});
    m.handle({type: 'click-npc', payload: {entry: entryOf({sessionKind: kind,
      taskRef: kind === 'seek' ? 'task:find-bread' : undefined,
      label: kind === 'tour' ? '钟塔' : '找面包'})}});
    fired.length = 0;
    m.handle({type: 'route'});
    assert.strictEqual(m.state(), wantState, 'sessionKind=' + kind + ' → ' + wantState);
    const upd = fired.find((e) => e.name === 'town-ui/dialog/update');
    assert.ok(upd, 'route 随行 update');
    assert.strictEqual(upd.payload.step, wantState, 'step=' + wantState);
    assert.strictEqual(upd.payload.intent, wantIntent,
        'intent 词(矩阵: guide=tour/seek=find/help=give)');
    assert.strictEqual(upd.payload.canClose, true, 'canClose 恒 true');
  }
  /* payload.to 显式优先(会话分路裁决在装配层/玩法侧时可用) */
  const m2 = core.mkDialogMachine({emit: () => {}});
  m2.handle({type: 'click-npc', payload: {entry: entryOf({sessionKind: 'seek'})}});
  m2.handle({type: 'route', payload: {to: 'guide'}});
  assert.strictEqual(m2.state(), 'guide', 'payload.to 显式路由优先');
});

/* ============================================================
   ⑦ close 三值路由(§5.3 断言 4; §2.3 语义表)
   ============================================================ */

test('close 三值路由: defer→deferred; complete+end→done(taskRef 透传); continue-explore→continue', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  /* deferred: 任意会话态点稍后 */
  const rec = [];
  const m1b = core.mkDialogMachine({emit: (n, p) => rec.push({name: n, payload: p})});
  m1b.handle({type: 'click-npc', payload: {entry: entryOf()}});
  m1b.handle({type: 'route'});
  rec.length = 0;
  m1b.handle({type: 'defer'});
  assert.strictEqual(m1b.state(), 'idle', 'defer 回 idle');
  const c1 = rec.find((e) => e.name === 'town-ui/dialog/close');
  assert.ok(c1, 'defer 发 close');
  assert.strictEqual(c1.payload.result, 'deferred', '稍后=deferred(零负面语义)');
  assert.strictEqual(c1.payload.taskRef, 'task:find-bread', 'taskRef 透传');

  /* done: complete 自然结束(end) */
  const rec2 = [];
  const m2 = core.mkDialogMachine({emit: (n, p) => rec2.push({name: n, payload: p})});
  m2.handle({type: 'click-npc', payload: {entry: entryOf()}});
  m2.handle({type: 'route'});
  m2.handle({type: 'target-found'});
  m2.handle({type: 'confirm'});
  assert.strictEqual(m2.state(), 'praise', '前置: praise 态');
  m2.handle({type: 'next-step'});
  assert.strictEqual(m2.state(), 'complete', 'next-step 缺省→本轮完成(单步会话首版)');
  rec2.length = 0;
  m2.handle({type: 'end'});
  const c2 = rec2.find((e) => e.name === 'town-ui/dialog/close');
  assert.ok(c2, 'end 发 close');
  assert.strictEqual(c2.payload.result, 'done', '完成自然结束=done');
  assert.strictEqual(c2.payload.taskRef, 'task:find-bread', 'done 携 taskRef(A 落常驻完成)');

  /* continue: 继续看看 */
  const rec3 = [];
  const m3 = core.mkDialogMachine({emit: (n, p) => rec3.push({name: n, payload: p})});
  m3.handle({type: 'click-npc', payload: {entry: entryOf()}});
  m3.handle({type: 'route'});
  m3.handle({type: 'target-found'});
  m3.handle({type: 'confirm'});
  m3.handle({type: 'next-step'});
  rec3.length = 0;
  m3.handle({type: 'continue-explore'});
  const c3 = rec3.find((e) => e.name === 'town-ui/dialog/close');
  assert.ok(c3, 'continue-explore 发 close');
  assert.strictEqual(c3.payload.result, 'continue', '继续看看=continue');
});

test('轻问候收尾: greet+pick-option→close{continue} 无 taskRef; greet+end 同(§2.2 L1 路径)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const rec = [];
  const m = core.mkDialogMachine({emit: (n, p) => rec.push({name: n, payload: p})});
  m.handle({type: 'click-npc', payload: {entry: entryOf({id: 'market', kind: 'prop',
    iconKey: 'plaza', label: '市集摊位', sessionKind: undefined, taskRef: undefined})}});
  assert.strictEqual(m.snapshot().sessionKind, 'greet',
      '无 sessionKind 条目→轻问候会话(装配层 L1 语义)');
  rec.length = 0;
  m.handle({type: 'pick-option'});
  assert.strictEqual(m.state(), 'idle', '挥手回应收尾回 idle');
  const c = rec.find((e) => e.name === 'town-ui/dialog/close');
  assert.ok(c, '轻问候收尾发 close');
  assert.strictEqual(c.payload.result, 'continue', '轻问候=continue(§5.3 场景 4)');
  assert.strictEqual('taskRef' in c.payload, false, '轻问候无任务语义, 零 taskRef');
});

/* ============================================================
   ⑧ 零倒计时零惩罚语义专项(MISSION 硬约束)
   ============================================================ */

test('零惩罚语义: 任意会话态 defer 只发一条 close 且零负面; complete 态 defer 被零惩罚拒绝(出口态无稍后钮)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  /* 每个会话态 defer 都恰一条 close(deferred), 无其他惩罚性事件;
     构造按态显式路由(route 的 payload.to 显式优先, 绕开 seek 条目
     sessionKind 缺省路由的构造歧义——裁决修复 2026-11-14);
     complete 不在循环: 它是出口态, 无 defer 边(转移表断言锁定),
     其「defer 意图被零惩罚拒绝」单独断言于循环后 */
  const states = ['greet', 'guide', 'seek', 'help', 'respond', 'praise'];
  const buildTo = {
    greet: (m) => m.handle({type: 'click-npc', payload: {entry: entryOf()}}),
    guide: (m) => {
      m.handle({type: 'click-npc', payload: {entry: entryOf()}});
      m.handle({type: 'route', payload: {to: 'guide'}});
    },
    seek: (m) => {
      m.handle({type: 'click-npc', payload: {entry: entryOf()}});
      m.handle({type: 'route', payload: {to: 'seek'}});
    },
    help: (m) => {
      m.handle({type: 'click-npc', payload: {entry: entryOf()}});
      m.handle({type: 'route', payload: {to: 'help'}});
    },
    respond: (m) => {
      m.handle({type: 'click-npc', payload: {entry: entryOf()}});
      m.handle({type: 'route', payload: {to: 'seek'}});
      m.handle({type: 'target-found'});
    },
    praise: (m) => {
      m.handle({type: 'click-npc', payload: {entry: entryOf()}});
      m.handle({type: 'route', payload: {to: 'seek'}});
      m.handle({type: 'target-found'});
      m.handle({type: 'confirm'});
    },
  };
  for (const target of states) {
    const rec = [];
    const m = core.mkDialogMachine({emit: (n, p) => rec.push({name: n, payload: p})});
    buildTo[target](m);
    assert.strictEqual(m.state(), target, '前置: ' + target);
    rec.length = 0;
    m.handle({type: 'defer'});
    const closes = rec.filter((e) => e.name === 'town-ui/dialog/close');
    assert.strictEqual(closes.length, 1, target + ' defer 恰一条 close');
    assert.strictEqual(closes[0].payload.result, 'deferred', '零负面退出');
    assert.strictEqual(rec.length, 1, target + ' defer 零附带事件(无惩罚/无警示)');
  }
  /* complete 出口态: defer 无边, 意图被零惩罚拒绝(changed:false 零事件;
     出口只有[继续看看]/[再见]两个正向选项, 零惩罚语义由转移表+此处共同锁) */
  {
    const rec = [];
    const m = core.mkDialogMachine({emit: (n, p) => rec.push({name: n, payload: p})});
    m.handle({type: 'click-npc', payload: {entry: entryOf()}});
    m.handle({type: 'route', payload: {to: 'seek'}});
    m.handle({type: 'target-found'});
    m.handle({type: 'confirm'});
    m.handle({type: 'next-step'});
    assert.strictEqual(m.state(), 'complete', '前置: complete');
    rec.length = 0;
    const out = m.handle({type: 'defer'});
    assert.deepStrictEqual(out, {changed: false, events: []},
        'complete 态 defer 零惩罚拒绝(出口态)');
    assert.strictEqual(rec.length, 0, 'complete defer 零事件零惩罚');
  }
});

/* ============================================================
   ⑨ 徽章累积(§5.3 断言 6; §7.1 不倒扣不清零)
   ============================================================ */

test('dialogBadgesAfter: 顺序稳定只增不减; 达 badgesMax=3 封顶; 入参零突变', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const before = [{iconId: 'star'}, {iconId: 'flower'}];
  const after = core.dialogBadgesAfter(before, {level: 'light', iconId: 'star'});
  assert.strictEqual(after.length, 3, '第三枚入列');
  assert.deepStrictEqual(after, [{iconId: 'star'}, {iconId: 'flower'}, {iconId: 'star'}],
      '顺序稳定(尾追加)');
  assert.deepStrictEqual(before, [{iconId: 'star'}, {iconId: 'flower'}],
      '入参零突变(纯函数红线)');
  const capped = core.dialogBadgesAfter(after, {level: 'cheer', iconId: 'flower'});
  assert.strictEqual(capped.length, 3, 'cap=3 封顶(丢新不顶替)');
  assert.deepStrictEqual(capped, after, '封顶后内容不变(只增不减)');
});

test('机器内徽章: praise 累积 1 枚; 会话内不清零(§7.1); snapshot.badges 只读', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const m = mkSeekMachine();
  m.handle({type: 'target-found'});
  m.handle({type: 'confirm'});
  assert.strictEqual(m.state(), 'praise', '前置: praise');
  assert.strictEqual(m.snapshot().badges.length, 1, 'praise 累积一枚徽章');
  assert.strictEqual(m.snapshot().badges.length, 1, 'snapshot 只读(重复读不翻倍)');
});

/* ============================================================
   ⑩ TTS 仲裁三分支(§5.3 断言 7; prebuild §4.2)
   ============================================================ */

test('ttsPlanFor: 高优抢占(now+cancelCurrent)/低优入队(queue)/队满丢新句(drop)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  /* 空闲通道: 直接播 */
  const p1 = core.ttsPlanFor({priority: 4, text: '你好呀', channel: 'B'},
      [], {currentPriority: null, queueMax: 2, preempt: 'higher-only',
        suppressAInSession: true, inSession: true});
  assert.deepStrictEqual(p1, {mode: 'now', cancelCurrent: false}, '空闲通道直接播');
  /* 高于当前: 抢占(cancel+say) */
  const p2 = core.ttsPlanFor({priority: 5, text: '再听一次', channel: 'B'},
      [], {currentPriority: 4, queueMax: 2, preempt: 'higher-only',
        suppressAInSession: true, inSession: true});
  assert.deepStrictEqual(p2, {mode: 'now', cancelCurrent: true}, 'higher-only 抢占');
  /* 不高于当前: 入队 */
  const p3 = core.ttsPlanFor({priority: 4, text: '下一步', channel: 'B'},
      [], {currentPriority: 4, queueMax: 2, preempt: 'higher-only',
        suppressAInSession: true, inSession: true});
  assert.strictEqual(p3.mode, 'queue', '同级不抢占→入队');
  /* 队满: 丢新句(不堆积轰炸) */
  const p4 = core.ttsPlanFor({priority: 4, text: '再一步', channel: 'B'},
      [{priority: 3, text: 'a'}, {priority: 3, text: 'b'}],
      {currentPriority: 4, queueMax: 2, preempt: 'higher-only',
        suppressAInSession: true, inSession: true});
  assert.strictEqual(p4.mode, 'drop', '队列上限满→丢新句');
  /* queue 参数零突变 */
  const q = [{priority: 3, text: 'a'}];
  core.ttsPlanFor({priority: 4, text: 'x', channel: 'B'}, q,
      {currentPriority: null, queueMax: 2, preempt: 'higher-only',
        suppressAInSession: true, inSession: true});
  assert.deepStrictEqual(q, [{priority: 3, text: 'a'}], 'queue 入参零突变');
});

test('ttsPlanFor: 会话中抑制 A 侧自动播报(P2 aTask drop, 不抢话)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const p = core.ttsPlanFor({priority: 2, text: '我们去钟塔吧!', channel: 'A'},
      [], {currentPriority: null, queueMax: 2, preempt: 'higher-only',
        suppressAInSession: true, inSession: true});
  assert.strictEqual(p.mode, 'drop', '会话中 A 通道 drop(suppressAInSession)');
  /* 会话外 A 通道放行 */
  const p2 = core.ttsPlanFor({priority: 2, text: '我们去钟塔吧!', channel: 'A'},
      [], {currentPriority: null, queueMax: 2, preempt: 'higher-only',
        suppressAInSession: true, inSession: false});
  assert.strictEqual(p2.mode, 'now', '会话外 A 通道照常');
});

/* ============================================================
   ⑪ A 侧收敛映射(§5.3 断言 8; prebuild §3.1 单源)
   ============================================================ */

test('hudConvergenceFor: idle/bubble 全 full; 会话七态 L1/L2 暂隐+L3 让位+世界降噪+A 播报抑制', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const full = core.hudConvergenceFor('idle');
  assert.deepStrictEqual({...full},
      {aL1: 'full', aL2: 'full', aL3: 'full', aWorld: 'full', aAutoTts: 'full'},
      'idle 全恢复档');
  assert.deepStrictEqual({...core.hudConvergenceFor('bubble')},
      {aL1: 'full', aL2: 'full', aL3: 'full', aWorld: 'full', aAutoTts: 'full'},
      'bubble 非会话不收敛(prebuild §2.1)');
  const dim = core.hudConvergenceFor('greet');
  assert.strictEqual(dim.aL1, 'hidden', 'L1 暂隐(P-H1 同档)');
  assert.strictEqual(dim.aL2, 'hidden', 'L2 暂隐(P-H2 同档)');
  assert.strictEqual(dim.aL3, 'frozen', 'L3 让位(会话内表扬归 B, §7.3 分工)');
  assert.strictEqual(dim.aWorld, 'min', '世界可交互提示降噪(UI-03 min 档)');
  assert.strictEqual(dim.aAutoTts, 'suppressed', 'A 自动播报抑制(不抢话)');
  for (const s of ['guide', 'seek', 'help', 'respond', 'praise', 'complete']) {
    assert.deepStrictEqual({...core.hudConvergenceFor(s)}, {...dim},
        s + ' 收敛档与 greet 一致(会话态单档)');
  }
});

/* ============================================================
   ⑫ 视图派生: 三件套视图模型(dialog-spec §4/§6; prebuild §5.2)
   ============================================================ */

test('dialogViewFor: idle/bubble 三件套空视图(无 panel 无 praise)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const idle = core.dialogViewFor('idle', {npcId: null});
  assert.strictEqual(idle.bubble, null, 'idle 无气泡');
  assert.strictEqual(idle.panel, null, 'idle 无面板');
  assert.strictEqual(idle.praise, null, 'idle 无表扬');
  const bubble = core.dialogViewFor('bubble',
      {npcId: 'bell-tower', npcLabel: '钟塔', iconKey: 'belltower'});
  assert.ok(bubble.bubble, 'bubble 态有气泡');
  assert.strictEqual(bubble.bubble.size, 'S', 'Bubble-S(短气泡)');
  assert.strictEqual(bubble.panel, null, 'bubble 态不开面板(局部提示不触发会话)');
  assert.strictEqual(bubble.praise, null, 'bubble 态无表扬');
});

test('dialogViewFor: greet/guide/help 面板在位(speaker/body/options/ghosts 恒带无压力出口)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const ctx = {npcId: 'task:find-bread', npcLabel: '找面包', iconKey: 'find',
    sessionKind: 'seek', targetIconId: 'bread', taskRef: 'task:find-bread'};
  const greet = core.dialogViewFor('greet', ctx);
  assert.ok(greet.panel, 'greet 开面板');
  assert.strictEqual(greet.panel.speaker.name, '找面包', 'Speaker 身份(角色即语境)');
  assert.strictEqual(greet.panel.ghosts.some((g) => g.id === 'defer'), true,
      '稍后 ghost 恒在(无压力出口常驻, §6.2)');
  assert.strictEqual(greet.panel.ghosts.some((g) => g.id === 'replay'), true,
      '再听 ghost 恒在(§4.4)');
  const guide = core.dialogViewFor('guide', Object.assign({}, ctx, {sessionKind: 'tour'}));
  assert.ok(guide.panel.options.length >= 1, 'guide 有主选项(知道啦)');
  assert.strictEqual(guide.panel.options.length <= core.DIALOG_OPTS.maxOptionsPerStep,
      true, '选项数 ≤ maxOptionsPerStep(B3)');
  const help = core.dialogViewFor('help', Object.assign({}, ctx, {sessionKind: 'help'}));
  assert.ok(help.panel.options.length >= 1, 'help 有选项(给你)');
});

test('dialogViewFor: seek 目标缩略图常驻(B6)+hasPendingChoice; praise 徽章不阻塞; complete 出口', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const ctx = {npcId: 'task:find-bread', npcLabel: '找面包', iconKey: 'find',
    sessionKind: 'seek', targetIconId: 'bread', taskRef: 'task:find-bread'};
  const seek = core.dialogViewFor('seek', ctx);
  assert.ok(seek.panel.thumb, 'B6: Seek 态目标缩略图常驻');
  assert.strictEqual(seek.panel.thumb.iconId, 'bread', '缩略图=目标图标');
  assert.strictEqual(seek.panel.hasPendingChoice, true, 'seek 等待世界点选');
  const praise = core.dialogViewFor('praise', ctx);
  assert.ok(praise.praise, 'praise 徽章视图');
  assert.strictEqual(praise.praise.level, 'light', '单步表扬=轻量级');
  assert.strictEqual(praise.praise.iconId, 'star',
      '寻找/观察类=star(prebuild §4.1 资产映射)');
  assert.strictEqual(praise.panel.ghosts.some((g) => g.id === 'defer'), true,
      '表扬不阻塞关闭(出口可点, §5.4)');
  const praiseHelp = core.dialogViewFor('praise',
      Object.assign({}, ctx, {sessionKind: 'help'}));
  assert.strictEqual(praiseHelp.praise.iconId, 'flower', '帮助/关爱类=flower');
  const complete = core.dialogViewFor('complete', ctx);
  assert.strictEqual(complete.praise.level, 'cheer', '完成=热烈级');
  const labels = complete.panel.options.map((o) => o.label);
  assert.ok(labels.includes('继续看看'), 'complete 出口: 继续看看');
  assert.ok(labels.includes('再见'), 'complete 出口: 再见');
  assert.strictEqual(complete.panel.options.length <= 3, true, 'B3 选项上限');
});

/* ============================================================
   ⑬ 话术派生(§4.4 TTS 协同; §8 模板语义)
   ============================================================ */

test('dialogUtterFor: 会话态有句; bubble/idle 不播(B4 只管会话步); {n} 插值目标名', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const ctx = {npcLabel: '找面包', targetIconId: 'bread'};
  for (const s of ['greet', 'guide', 'seek', 'help', 'respond', 'praise', 'complete']) {
    const u = core.dialogUtterFor(s, ctx);
    assert.strictEqual(typeof u, 'string', s + ' 有播报句');
    assert.ok(u.length > 0, s + ' 句非空');
    assert.ok(!/\d+秒|\d+s\b/i.test(u), s + ' 句零倒计时语义(MISSION)');
  }
  assert.strictEqual(core.dialogUtterFor('bubble', ctx), null,
      'bubble 不播(矩阵 bubble 行「默认不播」, 避免与 A 抢话)');
  assert.strictEqual(core.dialogUtterFor('idle', ctx), null, 'idle 不播');
  const seekLine = core.dialogUtterFor('seek', ctx);
  assert.ok(seekLine.includes('找面包'), 'seek 句插值目标名(短文案 1-4 字辅助)');
});

/* ============================================================
   ⑭ 确定性(§5.3 断言 9)与零突变(§5.3 断言 10)
   ============================================================ */

test('确定性: 同一意图序列→相同事件序列与终态(零墙钟纯函数)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const run = () => {
    const rec = [];
    const m = core.mkDialogMachine({emit: (n, p) => rec.push({name: n, payload: p})});
    m.handle({type: 'click-npc', payload: {entry: entryOf()}});
    m.handle({type: 'route'});
    m.handle({type: 'target-found'});
    m.handle({type: 'confirm'});
    m.handle({type: 'next-step'});
    m.handle({type: 'end'});
    return {rec: JSON.parse(JSON.stringify(rec)), state: m.state()};
  };
  const a = run();
  const b = run();
  assert.deepStrictEqual(a, b, '同序列同输出(确定性)');
  assert.strictEqual(a.state, 'idle', '全链闭环回 idle');
  const names = a.rec.map((e) => e.name);
  assert.strictEqual(names.filter((n) => n === 'town-ui/dialog/open').length, 1, 'open 恰一次');
  assert.strictEqual(names[names.length - 1], 'town-ui/dialog/close', '收口是 close');
  assert.strictEqual(a.rec[a.rec.length - 1].payload.result, 'done', '终值 done');
});

test('会话可重入: close 后 snapshot 复位; 新会话 badges/stepN 干净不串轮(§5.3 断言 11)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const m = mkSeekMachine();
  m.handle({type: 'target-found'});
  m.handle({type: 'confirm'});
  assert.strictEqual(m.snapshot().badges.length, 1, '第一轮攒 1 徽章');
  m.handle({type: 'end'});
  assert.strictEqual(m.state(), 'idle', '第一轮收口');
  const snap = m.snapshot();
  assert.strictEqual(snap.npcId, null, 'close 后 npcId 复位(上下文清)');
  assert.strictEqual(snap.badges.length, 0, 'close 后徽章清(不跨轮)');
  assert.strictEqual(snap.stepN, 0, 'close 后步数清');
  /* 第二轮: 干净重开 */
  m.handle({type: 'click-npc', payload: {entry: entryOf()}});
  m.handle({type: 'route'});
  assert.strictEqual(m.snapshot().badges.length, 0, '第二轮徽章零残留');
  assert.strictEqual(m.snapshot().stepN, 1, '第二轮步数从头计');
});

test('snapshot 只读: 返回对象与数组为深拷贝(外部改写不反渗机器)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const m = mkSeekMachine();
  m.handle({type: 'target-found'});
  m.handle({type: 'confirm'});
  const snap = m.snapshot();
  snap.badges.push({iconId: 'hacked'});
  snap.stepN = 99;
  snap.state = 'idle';
  const fresh = m.snapshot();
  assert.strictEqual(fresh.badges.length, 1, '外部改写不反渗(badges)');
  assert.notStrictEqual(fresh.stepN, 99, '外部改写不反渗(stepN)');
  assert.notStrictEqual(fresh.state, 'idle', '外部改写不反渗(state)');
});

/* ============================================================
   ⑮ 参数表禁区: 零倒计时零失败态(§6.3 禁止项锁定)
   ============================================================ */

test('参数表禁区: DIALOG_OPTS 无倒计时/超时/失败/惩罚键(§6.3 禁止项)', () => {
  assert.ok(core, 'js/town-dialog-core.js 缺席(红期)');
  const banned = ['timeout', 'countdown', 'deadline', 'fail', 'penalty', 'retry',
    'timeLimit', 'expire'];
  const keys = Object.keys(core.DIALOG_OPTS).join('|').toLowerCase();
  for (const b of banned) {
    assert.ok(!keys.includes(b.toLowerCase()),
        '参数表禁词「' + b + '」(零倒计时零失败态)');
  }
});
