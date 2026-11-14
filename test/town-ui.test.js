'use strict';
/* 城镇 HUD 适配层与接线 (js/town-ui.js + adventure.js emit 缝) 可执行规格 —
   node --test (零依赖)
   运行: node --test test/town-ui.test.js
   T-UI-01 红测(票: docs/town-architecture-design.md §11 T-UI-01; 操作性规格:
   docs/design/town-ui-hud-prebuild.md §1-§2; 机器契约: 「T-UI 祗只换 emit
   不改机器」——js/town-interact-core.js mkTownTargets 零 hunk 由 commit 证据
   承担, 本文件守 emit 接线面)。只测票文要的外显行为, 全走公共 seam:
   ① 进镇出现/离镇收敛: 机器身份对账(进镇建机/离镇弃机经
      A.advTownState().targets 只读挂点感知)——白闪进镇→HUD 出现→回程→HUD
      收敛(机器在位/清空的壳层半边已由 test/adventure-mode.test.js T-SEAM-04
      端到端锁死, 本文件锁 UI 半边);
   ② emit 接线: townUiTargetEvent(机器事件名, 载荷)→提示卡随 focus/found
      更新(adventure.js 建机步只换 emit 实参, 判据/触发线/建机弃机步不动);
   ③ TTS 重播入口: 喇叭钮在位+重播完整句+不改状态机状态(prebuild §2.4);
   ④ 会话避让监听侧: townUiDialogEvent(dialog open/close)→非必要 HUD 收敛,
      dialog 本体零依赖(T-UI-04 域, 本票只做监听 seam);
   ⑤ 真件集成链: 真 town-interact-core 机器+真 town-ui-core 核心+适配层
      三件在 vm 同笼, 机器 focus/found 事件经 emit 实接线驱动卡片全链。
   装具: fake DOM 记录桩(经典脚本适配层无 THREE 硬依赖, DOM 走注入;
   adventure-mode.test.js fakeEl 先例简化版)。红期 js/town-ui.js 缺席全红。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 装具: 红期容忍装载 ---------- */
let townUi = null;
try {
  townUi = require('../js/town-ui.js');
} catch (e) {
  townUi = null;
}

/* fake DOM 元素(记录桩): 只实现适配层许用的最小面(创建/挂树/类名/显隐/
   文本/属性/onclick); 无 innerHTML/querySelector——适配层不重建不反查 */
function fakeEl(tag) {
  const classes = new Set();
  const el = {
    tag, children: [], parent: null, hidden: false, textContent: '',
    attrs: {}, style: {}, onclick: null,
    classList: {
      add(...cs) {
        for (const c of cs) classes.add(c);
      },
      remove(...cs) {
        for (const c of cs) classes.delete(c);
      },
      contains(c) {
        return classes.has(c);
      },
    },
    setAttribute(k, v) {
      el.attrs[k] = String(v);
    },
    getAttribute(k) {
      return el.attrs[k];
    },
    appendChild(c) {
      el.children.push(c);
      c.parent = el;
      return c;
    },
    click() {
      if (el.onclick) el.onclick({});
    },
  };
  return el;
}

function fakeDoc() {
  const body = fakeEl('body');
  return {
    body,
    createElement: (tag) => fakeEl(tag),
    getElementById: () => null,
  };
}

/* 记录桩语音(全文收集, cancel 计数) */
function fakeSpeech() {
  const rec = {spoken: [], cancels: 0};
  rec.speech = {
    speak(s) {
      rec.spoken.push(String(s));
    },
    cancel() {
      rec.cancels += 1;
    },
  };
  return rec;
}

/* 记录桩定时器(不真走墙钟: 装配层定时全部登记可手动泵) */
function fakeTimer() {
  const rec = {pending: []};
  rec.set = (fn, ms) => {
    const h = {fn, ms};
    rec.pending.push(h);
    return h;
  };
  rec.clear = (h) => {
    rec.pending = rec.pending.filter((x) => x !== h);
  };
  rec.fireAll = () => {
    const list = rec.pending.slice();
    rec.pending = [];
    for (const h of list) h.fn();
  };
  return rec;
}

/* 组装一只被测适配层: deps 全注入(零全局泄漏), 返回记录面+被测件 */
function mkHarness(machineRef) {
  const doc = fakeDoc();
  const rec = {speech: fakeSpeech(), timer: fakeTimer(), pages: []};
  rec.ui = townUi.mkTownUi({
    doc,
    machineRef: machineRef || (() => rec.machine || null),
    speech: rec.speech.speech,
    timer: rec.timer,
    showPage: (id) => rec.pages.push(id),
  });
  rec.doc = doc;
  return rec;
}

/* 槽位寻址(按类名在 root 直接子代中找——适配层结构契约) */
function slotOf(ui, cls) {
  assert.ok(ui.root, 'root 未挂载(前置失败)');
  const hit = ui.root.children.find((c) => c.classList.contains(cls));
  assert.ok(hit, '四槽缺失: .' + cls);
  return hit;
}

const TARGET = {id: 'bell-tower', kind: 'landmark', iconKey: 'belltower', label: '钟塔',
  anchor: {x: 60, y: 24, z: 60}, state: 'active'};

/* ============================================================
   ① 进镇出现 / 离镇收敛(机器身份对账)
   ============================================================ */

test('进镇出现: 机器在位 sync 即挂 #townHud 四槽 — L1 探索中轻状态 / L2 槽位空留(T-UI-02 域) / L4 回菜单钮', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const machine = {snapshot: () => ({focusId: null, states: {}})};
  const rec = mkHarness(() => machine);
  assert.strictEqual(rec.ui.root, null, '未进镇不挂载(零常驻 DOM)');
  rec.ui.sync();
  assert.ok(rec.ui.root, '进镇(机器在位)sync 后挂载');
  assert.strictEqual(rec.ui.root.attrs.id, 'townHud', '容器 id=townHud(prebuild §1.1)');
  slotOf(rec.ui, 'town-hud-card');
  slotOf(rec.ui, 'town-hud-pointer');
  slotOf(rec.ui, 'town-hud-praise');
  slotOf(rec.ui, 'town-hud-sys');
  assert.strictEqual(rec.ui.cardState(), 'idle-exploring',
      '进场且无任务=探索中轻状态(P-V1)');
  assert.strictEqual(slotOf(rec.ui, 'town-hud-pointer').children.length, 0,
      'L2 槽位只预留零内容(方位指引实现归 T-UI-02, 本票不越界)');
  const sys = slotOf(rec.ui, 'town-hud-sys');
  const home = sys.children.find((c) => c.attrs['aria-label'] === '回主菜单');
  assert.ok(home, 'L4 默认仅「返回主菜单」图标钮(prebuild §2.1)');
  rec.ui.sync(); /* 同机重复对账幂等 */
  assert.strictEqual(rec.ui.cardState(), 'idle-exploring', '重复 sync 不改卡态');
});

test('回程收敛: 机器弃机(引用清空) sync 即收敛 — 容器隐藏+语音停+卡态归 hidden(零惩罚无残留)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  let machine = {snapshot: () => ({focusId: null, states: {}})};
  const rec = mkHarness(() => machine);
  rec.ui.sync();
  rec.ui.targetEvent('town-ui/target/focus', {target: TARGET});
  assert.strictEqual(rec.ui.cardState(), 'active', '前置: 进行中');
  machine = null; /* 离镇弃机(T-SEAM-04: advTownTargets=undefined 同形) */
  rec.ui.sync();
  assert.strictEqual(rec.ui.root.hidden, true, '回程→HUD 收敛(容器隐藏, 验收锚)');
  assert.strictEqual(rec.ui.cardState(), 'hidden', '卡态归 hidden(离场/清场)');
  assert.ok(rec.speech.cancels >= 1, '离镇停语音(提示句不残声)');
});

test('新机不串轮: 机器引用换代 = 弃旧迎新 — 卡态复位探索中(第一轮 focus 不泄漏第二轮)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  let machine = {snapshot: () => ({focusId: 'bell-tower', states: {}})};
  const rec = mkHarness(() => machine);
  rec.ui.sync();
  rec.ui.targetEvent('town-ui/target/focus', {target: TARGET});
  assert.strictEqual(rec.ui.cardState(), 'active', '前置: 第一轮进行中');
  machine = {snapshot: () => ({focusId: null, states: {}})}; /* 每次进场新机(T-SEAM-04 契约) */
  rec.ui.sync();
  assert.strictEqual(rec.ui.cardState(), 'idle-exploring',
      '新机=新会话: 第一轮进行中不泄漏(机器不串轮的 UI 半边)');
});

/* ============================================================
   ② emit 接线: focus/found 事件驱动卡片(T-SEAM-04 目标协议消费面)
   ============================================================ */

test('emit 接线: focus→卡进行中+图标短标签+自动朗读完整句; found→完成一步+L3 表扬浮现+停留计时在 U7 窗', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const machine = {snapshot: () => ({focusId: 'bell-tower', states: {'bell-tower': 'active'}})};
  const rec = mkHarness(() => machine);
  rec.ui.sync();

  rec.ui.targetEvent('town-ui/target/focus', {target: TARGET});
  assert.strictEqual(rec.ui.cardState(), 'active', 'focus→进行中(验收锚字面)');
  const card = slotOf(rec.ui, 'town-hud-card');
  const label = card.children.find((c) => c.classList.contains('town-hud-card-label'));
  assert.ok(label && label.textContent === '钟塔', '短标签在位(1-6 字辅助, §4.3)');
  const ttsBtn = card.children.find((c) => c.classList.contains('town-hud-card-tts'));
  assert.ok(ttsBtn && !ttsBtn.hidden, 'TTS 重播钮仅 active/step-done 可见(U6/prebuild §2.4)');
  assert.deepStrictEqual(rec.speech.spoken, ['我们去钟塔吧！'],
      '新主提示自动朗读完整句一次(§4.4; 句式=core townHintSentence)');

  rec.ui.targetEvent('town-ui/target/update', {id: 'bell-tower', state: 'done'});
  assert.strictEqual(rec.ui.cardState(), 'step-done', 'found→完成一步(验收锚字面)');
  assert.ok(card.classList.contains('is-step-done'), '完成一步视觉档落卡(草绿语义类)');
  const praise = slotOf(rec.ui, 'town-hud-praise');
  assert.ok(praise.children.length >= 1, 'L3 表扬浮现位出现内容(UI-04 占位, §2.1)');
  const timerItems = rec.timer.pending.filter((h) => h.ms >= 1200 && h.ms <= 2000);
  assert.ok(timerItems.length >= 1, '表扬/停留定时在 U7 节奏窗 1.2-2.0s(墙钟归装配层)');
  rec.timer.fireAll();
  assert.strictEqual(rec.ui.cardState(), 'idle-exploring',
      '停留后无下一条自动收起(prebuild §2.3: focus 目标已 done)');
});

test('emit 接线: 未知事件名静默忽略(协议面恰四键, 未定事件不炸装配)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  assert.doesNotThrow(() => {
    rec.ui.targetEvent('town-ui/interact/focus', {id: 'x'}); /* T-UI-03 域事件: 本票不消费不炸 */
    rec.ui.targetEvent('town-ui/unknown/future', {});
  }, '协议外事件到达不得炸装配层(适配层只消费 target/focus+update)');
});

/* ============================================================
   ③ TTS 重播入口(喇叭钮; prebuild §2.4 逐行)
   ============================================================ */

test('重播钮: 点选重播当前提示完整句一次 — cancel-then-speak 不重叠抢话, 且不改状态机状态', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHarness(() => ({snapshot: () => ({focusId: 'bell-tower', states: {'bell-tower': 'active'}})}));
  rec.ui.sync();
  rec.ui.targetEvent('town-ui/target/focus', {target: TARGET});
  assert.strictEqual(rec.ui.cardState(), 'active', '前置: 进行中');
  const before = rec.speech.spoken.length;
  const ttsBtn = slotOf(rec.ui, 'town-hud-card')
      .children.find((c) => c.classList.contains('town-hud-card-tts'));
  ttsBtn.click();
  assert.strictEqual(rec.speech.spoken.length, before + 1, '点选重播恰好一次');
  assert.ok(rec.speech.spoken.includes('我们去钟塔吧！'), '重播完整友好句(短标签只是辅助)');
  assert.ok(rec.speech.cancels >= 1, 'cancel-then-speak(连点不重叠抢话, SpeechKit 统一通道)');
  assert.strictEqual(rec.ui.cardState(), 'active', '重播不改变状态机状态(prebuild §2.4 行为行)');
  /* 热区语义: aria-label 在位(44px 热区由 CSS token 承担, 这里锁可及性标注) */
  assert.strictEqual(ttsBtn.attrs['aria-label'], '再听一遍', '重播钮可及性标注在位');
});

test('L4 回菜单钮: 点选走宿主 chrome 页面缝(showPage(main)), 本票不另造退出链', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  const home = slotOf(rec.ui, 'town-hud-sys')
      .children.find((c) => c.attrs['aria-label'] === '回主菜单');
  home.click();
  assert.deepStrictEqual(rec.pages, ['main'],
      'L4 挂宿主 chrome(showPage(main), 模式页 back 按钮先例; mkMode 既有语义)');
});

/* ============================================================
   ④ 会话避让监听侧(dialog 本体零依赖, T-UI-04 域)
   ============================================================ */

test('会话避让: dialog open→L1/L2 收敛 L4 保持; close(continue)→恢复; close(done+taskRef)→落完成一步+表扬', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const machine = {snapshot: () => ({focusId: 'bell-tower', states: {'bell-tower': 'active'}})};
  const rec = mkHarness(() => machine);
  rec.ui.sync();
  rec.ui.targetEvent('town-ui/target/focus', {target: TARGET});

  rec.ui.dialogEvent('town-ui/dialog/open', {npcId: 'V01'});
  assert.strictEqual(slotOf(rec.ui, 'town-hud-card').hidden, true,
      'dialog open→L1 暂隐(P-H1, 监听侧收敛)');
  assert.strictEqual(slotOf(rec.ui, 'town-hud-pointer').hidden, true,
      'dialog open→L2 暂隐(P-H2)');
  assert.strictEqual(slotOf(rec.ui, 'town-hud-sys').hidden, false,
      'L4 保持(安全返回能力不收敛, prebuild §5 函数 2)');

  rec.ui.dialogEvent('town-ui/dialog/close', {result: 'continue'});
  assert.strictEqual(slotOf(rec.ui, 'town-hud-card').hidden, false, 'close(continue)→L1 恢复');
  assert.strictEqual(slotOf(rec.ui, 'town-hud-pointer').hidden, false, 'close(continue)→L2 恢复');
  assert.strictEqual(rec.ui.cardState(), 'active', '恢复原态(进行中)');

  rec.ui.dialogEvent('town-ui/dialog/open', {});
  rec.ui.dialogEvent('town-ui/dialog/close', {result: 'done', taskRef: 'task:find-bread'});
  assert.strictEqual(rec.ui.cardState(), 'step-done',
      'close(done+taskRef)→B 播局部完成, A 落常驻完成态(dialog-spec §2.3 宣布权分工)');
  assert.ok(slotOf(rec.ui, 'town-hud-praise').children.length >= 1, '完成伴随表扬浮现');
});

/* ============================================================
   ⑤ 接线守门(adventure.js emit 缝最小 diff + index.html 装配序)
   ============================================================ */

test('接线守门: adventure.js 建机步只换 emit 实参(守卫式) — 判据/触发线/建机弃机步零扰动', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'modes', 'adventure.js'), 'utf8');
  assert.ok(src.includes('mkTownTargets({emit:'), '建机步 mkTownTargets 工厂调用在位');
  assert.ok(src.includes("typeof townUiTargetEvent === 'function'"),
      'emit 实参换 townUiTargetEvent 守卫式(town-ui.js 未装载沙盒退回空旁路)');
  assert.ok(src.includes('if (drow === ADV_TOWN_DIM_ROW) advTownInteractBoot();'),
      '建机调用步原样(宿主建机步不动)');
  assert.ok(src.includes('advTownTargets = undefined;'), '弃机步原样(宿主弃机步不动)');
  assert.ok(src.includes('if (pos.z < ADV_TOWN_RETURN_Z) return;'),
      '回程触发线原样(触发线不动)');
});

test('接线守门: index.html 装配序 — css/town.css 链接在位; js/town-ui.js 在 interact-core 之后 mode-registry 之前', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(html.includes('css/town.css'), 'css/town.css 链接缺失');
  assert.ok(html.includes('js/town-ui.js'), 'js/town-ui.js script 缺失');
  const atCore = html.indexOf('js/town-interact-core.js');
  const atUi = html.indexOf('js/town-ui.js');
  const atRegistry = html.indexOf('js/mode-registry.js');
  assert.ok(atCore >= 0 && atCore < atUi && atUi < atRegistry,
      '装载序: town-interact-core < town-ui < mode-registry(emit 面运行时解析, 序即依赖)');
});

/* ============================================================
   ⑥ 真件集成链: 真机器+真核心+适配层同笼三件套
      (白闪进镇→HUD 出现→回程→HUD 收敛的 UI 半边全链)
   ============================================================ */

test('集成链: 真 mkTownTargets(emit 实接 townUiTargetEvent) focus/found 全链驱动卡片 — 机器零旁路直通 UI', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  /* vm 三件同笼: 机器真件(带 TOWN_MAP 依赖链)+核心真件+适配层工厂 */
  const sandbox = {console: {log() {}, warn() {}, error() {}}};
  const ctx = vm.createContext(sandbox);
  for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
    'js/town-map-core.js', 'js/town-assembly-core.js', 'js/town-interact-core.js',
    'js/town-ui-core.js', 'js/town-ui.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  /* 复刻 adventure.js 建机步形状: 机器 emit 实接 townUiTargetEvent(守卫同款) */
  vm.runInContext('var __doc = null; var __ui = mkTownUi({machineRef: function() { return __machine || null; }});', ctx);
  vm.runInContext('var __machine = mkTownTargets({emit: function(n, p) { __ui.targetEvent(n, p); }}); __ui.sync();', ctx);

  const state = () => vm.runInContext('__ui.cardState()', ctx);
  assert.strictEqual(state(), 'idle-exploring', '进镇建机→探索中轻状态');
  vm.runInContext('__machine.focus(\'bell-tower\')', ctx);
  assert.strictEqual(state(), 'active', '真机器 focus 事件经 emit 直通→进行中(零旁路)');
  vm.runInContext('__machine.found(\'task:find-bread\')', ctx);
  assert.strictEqual(state(), 'step-done', '真机器 found 事件经 emit 直通→完成一步');
  vm.runInContext('__machine = null; __ui.sync();', ctx);
  assert.strictEqual(vm.runInContext('__ui.root.hidden', ctx), true,
      '弃机→HUD 收敛(集成半边收口)');
});
