'use strict';
/* 城镇 HUD 纯决策核心 (js/town-ui-core.js) 可执行规格 — node --test (零依赖)
   运行: node --test test/town-ui-core.test.js
   T-UI-01 红测(票: docs/town-architecture-design.md §11 T-UI-01「城镇内 HUD
   布局与任务提示容器(分区 A)」; 操作性规格: docs/design/town-ui-hud-prebuild.md
   §1-§2/§5 函数 1-2/§6 参数总表; 设计权威: docs/design/town-ui-entry-hud-spec.md
   §4(4.1-4.6)+§8(U4-U8); 会话边界: town-ui-dialog-spec.md §2)。
   只测票文要的外显行为, 全走公共 seam:
   ① 参数锁表: TOWN_UI_PARAMS 常量表(prebuild §6 U4-U8+P 前缀参数化落点,
      供 PO 一处改; 单测锁表防漂移);
   ② 提示卡状态机: townHudCardState 五态恰集(prebuild §2.3: hidden/
      idle-exploring/active/step-done/dialog-dimmed——进行中+完成一步两态
      语义在 active/step-done)+任意事件序列不产生失败态(§4.5 硬约束)+
      转移逐条+副作用意图(tts-hint/praise-show);
   ③ 提示优先级决策: townHudDimming 分层可见性档(会话收敛 P-H1/P-H2/
      L3 冻结/L4 恒 normal 安全返回不收敛——hud-spec §4.3 末段+dialog-spec
      §2.3「注意力归会话」);
   ④ TTS 完整句: townHintSentence 模板(短标签只是辅助, TTS 才是完整句——
      hud-spec §4.3 第 3/4 条);
   ⑤ CSS token 对齐守门: css/town.css 落点存在+色板 token 值(prebuild
      §1.2, 取色 buildings §4)+安全区/热区 token+四槽类名+减少动态降级
      (hud-spec §4.3 动效行)。
   装具: vm 单件装载(纯核心零依赖, 加载即证明; 红期 town-ui-core.js 缺席
   全红)。红期 css/town.css 缺席→⑤ 红。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 装具: 纯核心单件装载(vm 共享词法环境还原, 红期缺席即红) ---------- */
function coreBoot() {
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  const file = 'js/town-ui-core.js';
  if (fs.existsSync(path.join(ROOT, file))) {
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotThrow(() => vm.runInContext(code, ctx, {filename: file}),
        '核心应可加载(顶层炸错在此暴露)');
  }
  return ctx;
}

const probe = (ctx, expr) => vm.runInContext(expr, ctx);
/* JSON 探针: 先证可序列化再解析——符号缺席时报「哪个符号缺席」而非
   JSON.parse(undefined) 的类型错误(红相可读, 重构缺席有清晰失败信息) */
const probeJson = (ctx, expr) => {
  const raw = probe(ctx, expr);
  assert.ok(typeof raw === 'string', '探测表达式未返回可序列化结果(符号缺席): ' + expr);
  return JSON.parse(raw);
};

/* ---------- 票面词汇表(与 green 侧实现共享的唯一拼写, 断言即契约) ---------- */
const FIVE_STATES = ['active', 'dialog-dimmed', 'hidden', 'idle-exploring', 'step-done'];
const EVENT_TYPES = ['dialog-close', 'dialog-open', 'enter', 'leave', 'step-elapse',
  'target-focus', 'target-update'];

/* 造一个主目标(hud-prebuild §2.6 townTarget 恰六键定稿, town-interact-core
   townTargetOf 同形——A 侧消费最小面) */
function mkTarget(overrides) {
  return Object.assign({id: 'bell-tower', kind: 'landmark', iconKey: 'belltower',
    label: '钟塔', anchor: {x: 60, y: 24, z: 60}, state: 'active'}, overrides || {});
}

/* 七类事件各造一条代表样本(载荷取实现票关心的最小面) */
function mkEvent(type) {
  switch (type) {
    case 'enter': return {type: 'enter'};
    case 'leave': return {type: 'leave'};
    case 'target-focus': return {type: 'target-focus', target: mkTarget()};
    case 'target-update': return {type: 'target-update', id: 'bell-tower', state: 'done'};
    case 'dialog-open': return {type: 'dialog-open'};
    case 'dialog-close': return {type: 'dialog-close', result: 'continue', prev: 'active'};
    case 'step-elapse': return {type: 'step-elapse', hasNext: false};
    default: throw new Error('未知事件类型 ' + type);
  }
}

/* ============================================================
   ① 参数锁表(prebuild §6 U4-U8 + P 前缀参数化落点, 供 PO 一处改)
   ============================================================ */

test('参数: TOWN_UI_PARAMS 在位且全冻结(含区间数组) — 参数化落点显式可一处改', () => {
  const {ctx} = coreBoot();
  assert.strictEqual(probe(ctx, 'typeof TOWN_UI_PARAMS'), 'object',
      '缺 TOWN_UI_PARAMS 常量表(prebuild §5 函数 10: 三票共用参数面)');
  assert.strictEqual(probe(ctx, 'Object.isFrozen(TOWN_UI_PARAMS)'), true,
      '常量表冻结(参数面不可被运行时改写, 锁表防漂移)');
  assert.strictEqual(probe(ctx,
      'Object.isFrozen(TOWN_UI_PARAMS.PRAISE_MS) && Object.isFrozen(TOWN_UI_PARAMS.T_IN_MS)'),
  true, '区间数组同样冻结(浅冻结不算数)');
});

test('参数: U4-U8 默认值照权威落(prebuild §6.1 逐键) — U8 如实标注流程项', () => {
  const {ctx} = coreBoot();
  const p = probeJson(ctx, 'JSON.stringify(TOWN_UI_PARAMS)');
  assert.strictEqual(p.U4_POINTER_MODE, 'landmark-pointer',
      'U4 指引形态=Landmark Pointer(§5.2 定稿; 首版不做小地图)');
  assert.strictEqual(p.U5_FALLBACK, 'belltower-fallback',
      'U5 无目标回落策略=钟塔弱提示(§3.3 落细默认)');
  assert.strictEqual(p.U6_REPLAY, true, 'U6 支持重播(喇叭钮, §2.4)');
  assert.strictEqual(p.U6_MANUAL_DISMISS, false,
      'U6 手动收起=可选不启用(默认自动随任务状态切换, §4.5 收起无负面后果)');
  assert.deepStrictEqual(p.PRAISE_MS, [1200, 2000],
      'U7 表扬节奏 1.2-2.0s(hud-spec §4.4)');
  assert.strictEqual(p.U7_PRAISE_SINGLE, true, 'U7 同屏 1 条不刷屏');
  assert.strictEqual(p.PRAISE_QUEUE_MAX, 1,
      'P-S1 等待队列深 1(新事件顶替等待项, prebuild §6.2)');
  assert.strictEqual(p.U8_PROCESS_ITEM, null,
      'U8=流程项非视觉参数, 无实现落点(如实标注, prebuild §6.1)');
});

test('参数: P 前缀布局/收敛/阈值默认值(prebuild §6.2/§6.3 逐键)', () => {
  const {ctx} = coreBoot();
  const p = probeJson(ctx, 'JSON.stringify(TOWN_UI_PARAMS)');
  assert.deepStrictEqual([p.SAFE_MIN_PX, p.SAFE_VW, p.SAFE_MAX_PX], [16, 1.6, 24],
      '安全区 clamp(16px, 1.6vw, 24px)(hud-spec §4.2 基线 16 随视口放大)');
  assert.deepStrictEqual([p.CARD_MAX_W_PX, p.CARD_MAX_VW], [320, 40],
      'L1 最大宽 min(320px, 40vw)(prebuild §1.3)');
  assert.strictEqual(p.HIT_MIN_PX, 44, '热区下限 44×44 CSS px 等效(§4.2/§6.4)');
  assert.deepStrictEqual([p.PRAISE_TOP_MIN_VH, p.PRAISE_TOP_VH, p.PRAISE_TOP_MAX_VH],
      [20, 24, 28], 'L3 浮现位垂直带 20vh-28vh(prebuild §1.3, 默认取中 24)');
  assert.deepStrictEqual([p.T_IN_MS, p.T_OUT_MS, p.T_TAP_MS],
      [[150, 250], [150, 250], [100, 120]],
      '动效窗(§1.4: 出现/退出 150-250ms, 按下回弹 100-120ms)');
  assert.strictEqual(p.L1_IDLE_DIM, 'dim',
      'P-V1 L1 无任务态=「探索中」轻状态弱化档(prebuild §6.2 默认)');
  assert.strictEqual(p.L1_DIALOG, 'hidden', 'P-H1 会话中 L1 暂隐(prebuild §6.2 默认)');
  assert.strictEqual(p.L2_DIALOG, 'hidden', 'P-H2 会话中 L2 暂隐(prebuild §6.2 默认)');
  assert.strictEqual(p.P_D1_NEARBY, 12, 'P-D1「就在附近」阈值 ≤12 格(prebuild §6.3)');
  assert.strictEqual(p.P_D2_NEAR, 40, 'P-D2「近/远」分界 40 格(prebuild §6.3)');
});

/* ============================================================
   ② 提示卡状态机(prebuild §2.3 五态口径; hud-spec §4.3 状态行)
   ============================================================ */

test('状态机: townHudCardState 在位, 状态全集恰为五态(进行中/完成一步两态语义在 active/step-done)', () => {
  const {ctx} = coreBoot();
  assert.strictEqual(probe(ctx, 'typeof townHudCardState'), 'function',
      '缺 townHudCardState(prebuild §5 函数 1)');
  const seen = new Set();
  for (const st of FIVE_STATES) {
    for (const ev of EVENT_TYPES) {
      const out = probeJson(ctx,
          'JSON.stringify(townHudCardState(' + JSON.stringify(st) + ', ' +
          JSON.stringify(mkEvent(ev)) + '))');
      seen.add(out.state);
    }
  }
  assert.deepStrictEqual([...seen].sort(), FIVE_STATES,
      '状态全集恰为 prebuild §2.3 五态(hidden/idle-exploring/active/step-done/dialog-dimmed)');
});

test('状态机: 任意事件序列不产生失败态(§4.5 硬约束: 无 fail/无倒计时惩罚语义)', () => {
  const {ctx} = coreBoot();
  /* 三步全扫描: 5 态 × 7 事件 × 7 事件 = 245 条确定性序列, 每步结果都必须
     落回五态集合(状态机不存在逃逸态=不存在 fail 类状态) */
  for (const st of FIVE_STATES) {
    for (const e1 of EVENT_TYPES) {
      const mid = probe(ctx, 'townHudCardState(' + JSON.stringify(st) + ', ' +
          JSON.stringify(mkEvent(e1)) + ').state');
      for (const e2 of EVENT_TYPES) {
        const out = probe(ctx, 'townHudCardState(' + JSON.stringify(mid) + ', ' +
            JSON.stringify(mkEvent(e2)) + ').state');
        assert.ok(FIVE_STATES.includes(out),
            '序列 ' + st + ' --' + e1 + '--> ' + mid + ' --' + e2 + '--> 逃逸出五态: ' + out);
      }
    }
  }
});

test('状态机: 进场无任务收「探索中」轻状态(P-V1); 收到主目标 focus 切进行中并给 tts 意图', () => {
  const {ctx} = coreBoot();
  const enter = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'hidden\', {type: \'enter\'}))');
  assert.strictEqual(enter.state, 'idle-exploring',
      'hidden --enter--> idle-exploring(进场且无任务, prebuild §2.3)');
  assert.deepStrictEqual(enter.intents, [], '轻状态无副作用意图');

  const fromIdle = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'idle-exploring\', {type: \'target-focus\', target: ' +
      JSON.stringify(mkTarget()) + '}))');
  assert.strictEqual(fromIdle.state, 'active', 'idle --target-focus--> active(进行中)');
  assert.deepStrictEqual(fromIdle.intents, ['tts-hint'],
      '新主提示出现自动朗读一次(§2.4 自动播报行)');

  const fromHidden = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'hidden\', {type: \'target-focus\', target: ' +
      JSON.stringify(mkTarget()) + '}))');
  assert.strictEqual(fromHidden.state, 'active', 'hidden --target-focus--> active(§2.3 直迁)');
  assert.deepStrictEqual(fromHidden.intents, ['tts-hint'], '直迁同样自动朗读');
});

test('状态机: 目标一步完成切「完成一步」(found→step-done)+表扬意图; 停留后 elapse 自动转移', () => {
  const {ctx} = coreBoot();
  const done = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'active\', {type: \'target-update\', id: \'bell-tower\', state: \'done\'}))');
  assert.strictEqual(done.state, 'step-done',
      'active --target-update done--> step-done(完成一步, prebuild §2.3)');
  assert.deepStrictEqual(done.intents, ['praise-show'],
      '完成一步伴随过程性表扬意图(§4.4 L3)');

  const noNext = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'step-done\', {type: \'step-elapse\', hasNext: false}))');
  assert.strictEqual(noNext.state, 'idle-exploring',
      'step-done 停留后无下一条→自动收起回探索中(prebuild §2.3)');
  const hasNext = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'step-done\', {type: \'step-elapse\', hasNext: true}))');
  assert.strictEqual(hasNext.state, 'active',
      'step-done 停留后有下一条→切进行中(prebuild §2.3)');
});

test('状态机: found 未聚焦目标同样给完成一步+表扬(零惩罚正向, 验收锚「found→完成一步」)', () => {
  const {ctx} = coreBoot();
  const out = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'active\', {type: \'target-update\', id: \'task:find-bread\', state: \'done\'}))');
  assert.strictEqual(out.state, 'step-done', '任意目标 found→完成一步(验收锚字面)');
  assert.deepStrictEqual(out.intents, ['praise-show'], '达成即表扬(§4.4 过程性)');
  /* 探索中收到 found: 卡保持轻状态, 表扬照给(不吞正向反馈) */
  const idle = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'idle-exploring\', {type: \'target-update\', id: \'task:find-bread\', state: \'done\'}))');
  assert.strictEqual(idle.state, 'idle-exploring', '无卡时状态不动(轻状态)');
  assert.deepStrictEqual(idle.intents, ['praise-show'], '表扬不因卡收起而吞掉');
});

test('状态机: 会话衔接(dialog) — open 收敛进 dialog-dimmed 且意图冻结(L3 不弹), close 按结果恢复/落完成', () => {
  const {ctx} = coreBoot();
  const open = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'active\', {type: \'dialog-open\'}))');
  assert.strictEqual(open.state, 'dialog-dimmed',
      'active --dialog-open--> dialog-dimmed(P-H1, prebuild §2.3)');
  assert.deepStrictEqual(open.intents, [],
      '会话中零新意图(L3 冻结: 会话中不弹全局表扬, prebuild §2.5)');

  const stepOpen = probe(ctx,
      'townHudCardState(\'step-done\', {type: \'dialog-open\'}).state');
  assert.strictEqual(stepOpen, 'dialog-dimmed', 'step-done --dialog-open--> dialog-dimmed');

  /* 会话中收到 found: 冻结——不切完成一步也不弹表扬(恢复时由 close 语义接管) */
  const foundInDialog = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'dialog-dimmed\', {type: \'target-update\', id: \'t\', state: \'done\'}))');
  assert.strictEqual(foundInDialog.state, 'dialog-dimmed', '会话中 found 不切态');
  assert.deepStrictEqual(foundInDialog.intents, [], '会话中 found 不弹表扬(L3 冻结)');

  /* 会话中收到新 focus: 维持收敛且不抢话(会话播报优先, dialog-spec §2.2 TTS 通道行) */
  const focusInDialog = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'dialog-dimmed\', {type: \'target-focus\', target: ' +
      JSON.stringify(mkTarget()) + '}))');
  assert.strictEqual(focusInDialog.state, 'dialog-dimmed', '会话中 focus 不切态');
  assert.deepStrictEqual(focusInDialog.intents, [], '会话中 focus 不自动朗读(不与 B 抢话)');

  /* close continue/deferred → 恢复原态(prev 由装配层记忆携带, 核心每调用无内部状态) */
  const restore = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'dialog-dimmed\', {type: \'dialog-close\', result: \'continue\', prev: \'active\'}))');
  assert.strictEqual(restore.state, 'active', 'close(continue) 恢复原态 active');
  assert.deepStrictEqual(restore.intents, [], '恢复无副作用');
  const restoreDefer = probe(ctx,
      'townHudCardState(\'dialog-dimmed\', {type: \'dialog-close\', result: \'deferred\', prev: \'idle-exploring\'}).state');
  assert.strictEqual(restoreDefer, 'idle-exploring', 'close(deferred) 恢复原态');

  /* close done+taskRef → 唯一落完成一步的 close 入口(B 播局部完成, A 落常驻状态——dialog-spec §2.3 宣布权分工) */
  const closeDone = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'dialog-dimmed\', {type: \'dialog-close\', result: \'done\', taskRef: \'task:find-bread\', prev: \'active\'}))');
  assert.strictEqual(closeDone.state, 'step-done', 'close(done+taskRef) → step-done');
  assert.deepStrictEqual(closeDone.intents, ['praise-show'], '完成一步伴随表扬');

  /* close done 但无 taskRef: 不落完成(与任务无关联), 照恢复原态 */
  const closeDoneNoRef = probe(ctx,
      'townHudCardState(\'dialog-dimmed\', {type: \'dialog-close\', result: \'done\', prev: \'active\'}).state');
  assert.strictEqual(closeDoneNoRef, 'active', 'close(done 无 taskRef) 只恢复不落完成');
});

test('状态机: 显式清空 focus(null) 回探索中; 离场/清场一律收 hidden; 会话外 close 恢复缺省探索中', () => {
  const {ctx} = coreBoot();
  const clear = probe(ctx,
      'townHudCardState(\'active\', {type: \'target-focus\', target: null}).state');
  assert.strictEqual(clear, 'idle-exploring',
      'focus null=显式清空→探索中(机器 focus(null) 语义对齐)');

  for (const st of FIVE_STATES) {
    const left = probe(ctx,
        'townHudCardState(' + JSON.stringify(st) + ', {type: \'leave\'}).state');
    assert.strictEqual(left, 'hidden', '离场收口: ' + st + ' --leave--> hidden(任意态可达)');
  }

  const closeNoPrev = probe(ctx,
      'townHudCardState(\'dialog-dimmed\', {type: \'dialog-close\', result: \'continue\'}).state');
  assert.strictEqual(closeNoPrev, 'idle-exploring',
      'close 未携 prev 时回落探索中(装配层失忆的失败安全缺省, 非惩罚语义)');
});

/* ============================================================
   ③ 提示优先级决策: townHudDimming 分层可见性档
      (hud-spec §4.3 末段+§0.3 屏幕层级行; prebuild §5 函数 2)
   ============================================================ */

test('可见性: townHudDimming 在位; 会话开=非必要 HUD 全收敛而 L4 恒 normal(安全返回不收敛)', () => {
  const {ctx} = coreBoot();
  assert.strictEqual(probe(ctx, 'typeof townHudDimming'), 'function',
      '缺 townHudDimming(prebuild §5 函数 2: 提示优先级决策面)');
  for (const st of FIVE_STATES) {
    const d = probeJson(ctx,
        'JSON.stringify(townHudDimming(' + JSON.stringify(st) + ', true))');
    assert.deepStrictEqual(d, {l1: 'hidden', l2: 'hidden', l3: 'frozen', l4: 'normal'},
        '会话开收敛档(' + st + '): L1 暂隐(P-H1)+L2 暂隐(P-H2)+L3 冻结+L4 保持(dialog-spec §2.3)');
  }
});

test('可见性: 会话关=按卡态恢复(L4 仍恒 normal; 探索中=弱化档 P-V1)', () => {
  const {ctx} = coreBoot();
  const byState = {
    hidden: 'hidden',
    'idle-exploring': 'dim',
    active: 'normal',
    'step-done': 'normal',
    'dialog-dimmed': 'hidden', /* 防御: 未恢复前保持暂隐(close 语义负责恢复) */
  };
  for (const [st, want] of Object.entries(byState)) {
    const d = probeJson(ctx,
        'JSON.stringify(townHudDimming(' + JSON.stringify(st) + ', false))');
    assert.strictEqual(d.l1, want, '会话关 L1 档(' + st + '): ' + want);
    assert.strictEqual(d.l2, 'normal', '会话关 L2 恢复(' + st + ')(T-UI-02 槽位本票只管显隐)');
    assert.strictEqual(d.l3, 'normal', '会话关 L3 解冻(' + st + ')');
    assert.strictEqual(d.l4, 'normal', 'L4 恒 normal(' + st + ', 安全返回能力永不收敛)');
  }
});

/* ============================================================
   ④ TTS 完整句(短标签只是辅助, TTS 才是完整句——hud-spec §4.3)
   ============================================================ */

test('话术: townHintSentence 由短标签派生完整友好句(§4.4 示例语气; 纯函数同参同输出)', () => {
  const {ctx} = coreBoot();
  assert.strictEqual(probe(ctx, 'typeof townHintSentence'), 'function',
      '缺 townHintSentence(重播钮播「完整友好句」, prebuild §2.4)');
  assert.strictEqual(probe(ctx, 'townHintSentence(\'钟塔\')'), '我们去钟塔吧！',
      '地标标签→完整句(hud-spec §4.4 示例「我们去广场看看吧」同语气)');
  assert.strictEqual(probe(ctx, 'townHintSentence(\'找面包\')'), '我们去找面包吧！',
      '任务标签→完整句(6 岁友好短句)');
  assert.strictEqual(probe(ctx, 'townHintSentence(\'钟塔\')'),
      probe(ctx, 'townHintSentence(\'钟塔\')'), '同参同输出(纯函数, 零墙钟零随机)');
});

/* ============================================================
   ⑤ CSS token 对齐守门(css/town.css 落点; prebuild §1.1-§1.4)
   ============================================================ */

test('CSS: css/town.css 在位且四槽命名空间/色板 token/安全区热区/减少动态降级逐项落位', () => {
  const file = path.join(ROOT, 'css', 'town.css');
  assert.ok(fs.existsSync(file), '缺 css/town.css(prebuild §1.1 建议落点, stylelint 生效面)');
  const css = fs.readFileSync(file, 'utf8');
  /* 色板 token(prebuild §1.2, 取色 buildings §4/dialog-spec; 不用警示红) */
  for (const [token, hex] of [
    ['--town-hud-base', '#f4d9a6'], ['--town-hud-ink', '#5a4636'],
    ['--town-hud-gold', '#e3b23c'], ['--town-hud-gold-bright', '#ffd89a'],
    ['--town-hud-sky', '#7ec8e3'], ['--town-hud-done', '#7fb069'],
    ['--town-hud-soft-white', '#fff9ec'], ['--town-hud-highlight', '#f6c96b'],
  ]) {
    /* 冒号后带空格: stylelint-config-standard declaration-colon-space-after=always 强制 */
    assert.ok(css.includes(token + ': ' + hex), '色板 token 缺失或值漂移: ' + token + ' 应为 ' + hex);
  }
  /* 布局与安全区 token(§1.3; 值与 TOWN_UI_PARAMS 同源字面) */
  assert.ok(css.includes('--town-hud-safe: clamp(16px, 1.6vw, 24px)'),
      '安全区 token 应为 clamp(16px, 1.6vw, 24px)(hud-spec §4.2)');
  assert.ok(css.includes('--town-hit-min: 44px'), '热区下限 token 应为 44px(§4.2/§6.4)');
  /* 四槽容器类(§1.1 容器结构; #townHud 子容器四槽) */
  for (const cls of ['town-hud-card', 'town-hud-pointer', 'town-hud-praise', 'town-hud-sys']) {
    assert.ok(css.includes('.' + cls), '四槽类名缺失: .' + cls);
  }
  /* 卡片三态类(五态的 DOM 可见面: hidden 由容器显隐承担, dialog-dimmed 由收敛档承担) */
  for (const cls of ['is-idle-exploring', 'is-active', 'is-step-done']) {
    assert.ok(css.includes('.' + cls), '卡片态类缺失: .' + cls);
  }
  /* 减少动态偏好降级(hud-spec §4.3 动效行: 降级为纯淡入淡出、停呼吸) */
  assert.ok(css.includes('prefers-reduced-motion'), '缺 prefers-reduced-motion 降级块');
});
