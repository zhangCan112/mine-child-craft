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
      (hud-spec §4.3 动效行);
   ⑥ 方位指引纯决策面(T-UI-02): 指引目标解析/距离三档/方位离散/指引签名
      (prebuild §5 函数 3-6, hud-spec §5.2 Landmark Pointer)+指引器 CSS
      结构类与 reduced-motion 停呼吸守门。
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
  return {ctx};
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
      'JSON.stringify(townHudCardState(\'active\', {type: \'target-update\', ' +
      'id: \'task:find-bread\', state: \'done\'}))');
  assert.strictEqual(out.state, 'step-done', '任意目标 found→完成一步(验收锚字面)');
  assert.deepStrictEqual(out.intents, ['praise-show'], '达成即表扬(§4.4 过程性)');
  /* 探索中收到 found: 卡保持轻状态, 表扬照给(不吞正向反馈) */
  const idle = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'idle-exploring\', {type: \'target-update\', ' +
      'id: \'task:find-bread\', state: \'done\'}))');
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
      'JSON.stringify(townHudCardState(\'dialog-dimmed\', ' +
      '{type: \'dialog-close\', result: \'continue\', prev: \'active\'}))');
  assert.strictEqual(restore.state, 'active', 'close(continue) 恢复原态 active');
  assert.deepStrictEqual(restore.intents, [], '恢复无副作用');
  const restoreDefer = probe(ctx,
      'townHudCardState(\'dialog-dimmed\', ' +
      '{type: \'dialog-close\', result: \'deferred\', prev: \'idle-exploring\'}).state');
  assert.strictEqual(restoreDefer, 'idle-exploring', 'close(deferred) 恢复原态');

  /* close done+taskRef → 唯一落完成一步的 close 入口(B 播局部完成, A 落常驻状态——dialog-spec §2.3 宣布权分工) */
  const closeDone = probeJson(ctx,
      'JSON.stringify(townHudCardState(\'dialog-dimmed\', ' +
      '{type: \'dialog-close\', result: \'done\', taskRef: \'task:find-bread\', ' +
      'prev: \'active\'}))');
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
    'hidden': 'hidden',
    'idle-exploring': 'dim',
    'active': 'normal',
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

/* ============================================================
   ⑥ 方位指引纯决策面(T-UI-02; prebuild §5 函数 3-6+§3.3 阈值口径;
      hud-spec §5.2 Landmark Pointer 默认)——全走纯函数 seam,
      零 DOM 零墙钟, 阈值消费 TOWN_UI_PARAMS.P_D1_NEARBY/P_D2_NEAR。
   ============================================================ */

/* 指引回落锚(N 端测试固定值; 装配层生产取 TOWN_MAP.anchors bell-tower) */
const FB_ANCHOR = {x: 79, y: 24, z: 76};

test('指引目标解析(prebuild §5 函数 3): 有目标=原样 target; null+钟塔回落=fallback 携回落锚; null+hidden=off; 策略越域抛错', () => {
  const {ctx} = coreBoot();
  assert.strictEqual(probe(ctx, 'typeof townPointerTarget'), 'function',
      '缺 townPointerTarget 纯函数(prebuild §5 函数 3: 指引目标解析, T-UI-02)');
  /* 有目标: 原样透传(mode=target), 回落策略只管 null 情形 */
  const withTarget = probeJson(ctx,
      'JSON.stringify(townPointerTarget(' +
      '{id: \'farm\', kind: \'landmark\', iconKey: \'farm\', label: \'小农田\', ' +
      'anchor: {x: 71, y: 24, z: 58}, state: \'active\'}, ' +
      '{fallback: \'hidden\', fallbackAnchor: {x: 79, y: 24, z: 76}}))');
  assert.strictEqual(withTarget.mode, 'target', '有目标=目标态(策略不抢活目标)');
  assert.strictEqual(withTarget.iconKey, 'farm', '目标态图标=目标 iconKey(UI-01 语义键透传)');
  assert.deepStrictEqual(withTarget.anchor, {x: 71, y: 24, z: 58},
      '目标态锚点=目标锚点(指向几何的唯一锚源)');
  /* null+钟塔回落(U5 默认): 弱提示携回落锚(默认指钟塔方位, 保留回家语义 §3.1) */
  const fallback = probeJson(ctx,
      'JSON.stringify(townPointerTarget(null, ' +
      '{fallback: \'belltower-fallback\', fallbackAnchor: {x: 79, y: 24, z: 76}}))');
  assert.strictEqual(fallback.mode, 'fallback', 'null+U5 默认=钟塔弱提示态(§5.2 可见性策略)');
  assert.strictEqual(fallback.iconKey, 'belltower', '弱提示图标恒钟塔(回家/集合锚点语义)');
  assert.deepStrictEqual(fallback.anchor, {x: 79, y: 24, z: 76},
      '弱提示锚点=注入的钟塔回落锚(核心零依赖, 锚由装配层喂)');
  /* null+hidden 策略: 全收起(off), 锚图标皆空(零方向零图标断言) */
  const off = probeJson(ctx,
      'JSON.stringify(townPointerTarget(null, {fallback: \'hidden\'}))');
  assert.strictEqual(off.mode, 'off', 'null+hidden=off(无目标全收起档)');
  assert.strictEqual(off.anchor, null, 'off 态零锚点(不伪造方向)');
  assert.strictEqual(off.iconKey, null, 'off 态零图标');
  /* 策略越域: 拼写域抛错(本仓纯函数越域抛错惯例, registry 同款) */
  assert.throws(() => probe(ctx,
      'townPointerTarget(null, {fallback: \'always-visible\'})'),
  /belltower-fallback|hidden|越域|fallback/,
  '回落策略越域须抛错(域恰 belltower-fallback|hidden 两值, 静默吞拼写错=漂移温床)');
});

test('距离分档(prebuild §5 函数 4): 边界恰等逐个(P_D1=12 nearby 需在视野; P_D2=40 near; >40 far); inView=false nearby 不可达; 阈值注入生效', () => {
  const {ctx} = coreBoot();
  assert.strictEqual(probe(ctx, 'typeof townPointerBand'), 'function',
      '缺 townPointerBand 纯函数(prebuild §5 函数 4: 距离三档定性, T-UI-02)');
  const band = (d, v, b) => probeJson(ctx,
      'JSON.stringify(townPointerBand(' + d + ', ' + v + ', ' +
      (b ? b : 'null') + '))');
  /* 边界恰等(P-D1=12): ≤12 且在视野角内=就在附近(§3.3 判定口径) */
  assert.strictEqual(band(12, true), 'nearby', 'dist 恰=12 且在视野→nearby(≤P_D1 含等号)');
  assert.strictEqual(band(12, false), 'near', 'dist 恰=12 但不在视野→near(附近档需在视野内)');
  assert.strictEqual(band(0, true), 'nearby', 'dist=0(踩在锚上)且在视野→nearby');
  assert.strictEqual(band(11.9, true), 'nearby', 'dist<12 在视野→nearby');
  assert.strictEqual(band(12.1, true), 'near', 'dist 恰过 12→near(边界不含外沿)');
  /* 边界恰等(P-D2=40): ≤40=near(近, 双环), >40=far(远, 单细环) */
  assert.strictEqual(band(40, true), 'near', 'dist 恰=40→near(≤P_D2 含等号)');
  assert.strictEqual(band(40, false), 'near', 'dist 恰=40 不在视野→near(near/far 不依赖视野)');
  assert.strictEqual(band(40.1, true), 'far', 'dist 恰过 40→far(边界不含外沿)');
  assert.strictEqual(band(120, true), 'far', '远距→far(儿童化三档不显数字)');
  /* 阈值注入生效(P-D1/P-D2 可注入覆盖, prebuild §5 函数 4 注入位) */
  assert.strictEqual(band(5, true, '{nearby: 5, near: 10}'), 'nearby',
      '注入阈值后 5≤5 且在视野→nearby');
  assert.strictEqual(band(5, false, '{nearby: 5, near: 10}'), 'near',
      '注入阈值后 5 但不在视野→near(inView 短路不随注入失效)');
  assert.strictEqual(band(5.1, true, '{nearby: 5, near: 10}'), 'near',
      '注入阈值后恰过 5→near');
  assert.strictEqual(band(10.1, true, '{nearby: 5, near: 10}'), 'far',
      '注入阈值后恰过 10→far');
});

test('方位离散(prebuild §5 函数 5): 四正交向恰等边界归属明确(前含 ±45°); 左右后全覆盖无间隙; yaw 回绕(±360°)不变; 零位移归 front', () => {
  const {ctx} = coreBoot();
  assert.strictEqual(probe(ctx, 'typeof townPointerHeading'), 'function',
      '缺 townPointerHeading 纯函数(prebuild §5 函数 5: 4 方位离散, T-UI-02)');
  const heading = (dx, dz, y) => probeJson(ctx,
      'JSON.stringify(townPointerHeading(' + dx + ', ' + dz + ', ' + y + '))');
  /* 朝向约定: 前向=(-sin yaw, -cos yaw)(camera-rig lookDir 同式, yaw=0 面北 -Z) */
  assert.strictEqual(heading(0, -5, 0), 'front', '面北目标在北→front(正交向恰等)');
  assert.strictEqual(heading(5, 0, 0), 'right', '面北目标在东→right(右手 = +X)');
  assert.strictEqual(heading(-5, 0, 0), 'left', '面北目标在西→left');
  assert.strictEqual(heading(0, 5, 0), 'behind', '面北目标在南→behind(恰反向)');
  /* 45° 边界: 恰在对角线上归 front(±45° 含等号, 「恰在前方=front」预排口径) */
  assert.strictEqual(heading(5, -5, 0), 'front', '东北恰 45°→front(边界含等号)');
  assert.strictEqual(heading(-5, -5, 0), 'front', '西北恰 45°→front(对称边界)');
  assert.strictEqual(heading(6, -4, 0), 'right', '东北偏东(>45°)→right(边界外沿换档)');
  assert.strictEqual(heading(-6, -4, 0), 'left', '西北偏西(>45°)→left');
  /* 135° 边界: 恰在对角线上归侧向(≤135° 仍侧档), 越过归 behind */
  assert.strictEqual(heading(5, 5, 0), 'right', '东南恰 135°→right(侧档含等号)');
  assert.strictEqual(heading(-5, 5, 0), 'left', '西南恰 135°→left');
  assert.strictEqual(heading(5, 6, 0), 'behind', '东南偏南(>135°)→behind(全覆无间隙)');
  assert.strictEqual(heading(-5, 6, 0), 'behind', '西南偏南(>135°)→behind');
  /* 面向变化: 同一目标随玩家朝向换档(yaw=±90° 正交验证) */
  assert.strictEqual(heading(-5, 0, Math.PI / 2), 'front', '面西(yaw=π/2)目标在西→front');
  assert.strictEqual(heading(5, 0, -Math.PI / 2), 'front', '面东(yaw=-π/2)目标在东→front');
  assert.strictEqual(heading(0, -5, -Math.PI / 2), 'left', '面东目标在北→left(朝向驱动档位)');
  /* yaw 回绕: ±360° 同向不换档(预排「朝向回绕正确」) */
  assert.strictEqual(heading(0, -5, 2 * Math.PI), 'front', 'yaw=2π≡0→front(回绕不变)');
  assert.strictEqual(heading(0, -5, -2 * Math.PI), 'front', 'yaw=-2π≡0→front(负回绕不变)');
  assert.strictEqual(heading(0, -5, 3 * Math.PI), 'behind', 'yaw=3π≡π→behind(多圈回绕)');
  /* 零位移退化: 玩家踩在锚上→front(站上目标即「在视野」, 配 dist=0 → nearby) */
  assert.strictEqual(heading(0, 0, 0), 'front', '零位移(踩锚)→front(不伪造方位, 配合 nearby 档)');
});

test('指引签名(prebuild §5 函数 6+§3.4 脏标口径): 同入参恒等; 四分量任一变化签名必变(无闪烁承诺的 core 半边)', () => {
  const {ctx} = coreBoot();
  assert.strictEqual(probe(ctx, 'typeof townPointerSig'), 'function',
      '缺 townPointerSig 纯函数(prebuild §5 函数 6: targetId|state|档位 签名, T-UI-02)');
  const sig = (id, st, b, h) => probeJson(ctx,
      'JSON.stringify(townPointerSig(' + (id === null ? 'null' : "'" + id + "'") +
      ", '" + st + "', '" + b + "', '" + h + "'))");
  assert.strictEqual(typeof sig('bell-tower', 'active', 'near', 'front'), 'string',
      '签名是字符串(DOM 脏标比较载体)');
  assert.strictEqual(sig('bell-tower', 'active', 'near', 'front'),
      sig('bell-tower', 'active', 'near', 'front'),
      '同入参恒等签名(同位姿重复计算恒等——§3.4 无闪烁承诺 core 半边)');
  assert.notStrictEqual(sig('bell-tower', 'active', 'near', 'front'),
      sig('farm', 'active', 'near', 'front'), '目标 id 变→签名变');
  assert.notStrictEqual(sig('bell-tower', 'active', 'near', 'front'),
      sig('bell-tower', 'done', 'near', 'front'), '目标状态变→签名变');
  assert.notStrictEqual(sig('bell-tower', 'active', 'near', 'front'),
      sig('bell-tower', 'active', 'nearby', 'front'), '距离档变→签名变');
  assert.notStrictEqual(sig('bell-tower', 'active', 'near', 'front'),
      sig('bell-tower', 'active', 'near', 'left'), '方位档变→签名变');
  /* null 目标 id 亦可签名(无目标回落态同样进脏标对账, 不炸不歧义) */
  assert.strictEqual(sig(null, 'fallback', 'near', 'behind'),
      sig(null, 'fallback', 'near', 'behind'), 'null 目标恒等签名(回落态可对账)');
  assert.notStrictEqual(sig(null, 'fallback', 'near', 'behind'),
      sig('bell-tower', 'fallback', 'near', 'behind'), 'null 与有值 id 签名可区分');
});

test('CSS(T-UI-02): 指引器徽章/中心图标/方位指针/距离档/方位档/目标回落态类落位 + 呼吸动效与 reduced-motion 停呼吸(prebuild §3.1/§3.4)', () => {
  const file = path.join(ROOT, 'css', 'town.css');
  assert.ok(fs.existsSync(file), '缺 css/town.css');
  const css = fs.readFileSync(file, 'utf8');
  /* 徽章三件套类(DOM↔CSS 契约: 适配层按这些类名落结构) */
  for (const cls of ['town-hud-pointer-badge', 'town-hud-pointer-icon',
    'town-hud-pointer-arrow']) {
    assert.ok(css.includes('.' + cls), '指引器结构类缺失: .' + cls);
  }
  /* 距离三档类(注意 band-near 用词边界防 band-nearby 前缀误配) */
  assert.ok(css.match(/\.band-nearby/), '距离档类缺失: .band-nearby(就在附近)');
  assert.ok(css.match(/\.band-near\b/), '距离档类缺失: .band-near(近)');
  assert.ok(css.match(/\.band-far\b/), '距离档类缺失: .band-far(远)');
  /* 方位四档类(指针离散转动载体, CSS transition 承担低频插值) */
  for (const cls of ['is-front', 'is-left', 'is-right', 'is-behind']) {
    assert.ok(css.match(new RegExp('\\.' + cls + '\\b')), '方位档类缺失: .' + cls);
  }
  /* 目标态/回落态(weak hint 50% 半透明弱提示, U5 默认) */
  assert.ok(css.match(/\.is-target\b/), '目标态类缺失: .is-target');
  assert.ok(css.match(/\.is-fallback\b/), '回落态类缺失: .is-fallback(钟塔弱提示)');
  /* 呼吸动效(附近档柔光呼吸 ≥1s 周期)与 reduced-motion 停呼吸(§3.4 动效行) */
  assert.ok(css.includes('town-hud-pointer-breathe'), '缺指引器呼吸动效(附近档柔光呼吸)');
  const reducedAt = css.indexOf('prefers-reduced-motion');
  assert.ok(reducedAt >= 0, '缺 prefers-reduced-motion 降级块');
  const reducedBlock = css.slice(reducedAt);
  assert.ok(reducedBlock.includes('town-hud-pointer-breathe') &&
      reducedBlock.includes('animation: none'),
  'reduced-motion 须停指引器呼吸(动效克制: 降级为静态柔光)');
});
