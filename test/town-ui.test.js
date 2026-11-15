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
   ② emit 接线: townUiTargetEvent(机器事件名, 载荷)→核心态随 focus/found
      步进(adventure.js 建机步只换 emit 实参, 判据/触发线/建机弃机步不动;
      左上状态卡已移除, PO 返工 2026-11-15——核心态 headless 保留, L3 表扬/
      L2 指引语义不变, 卡话术 tts-hint 同步撤);
   ③ TTS 重播入口: 随左上状态卡移除撤除(重播钮=卡右端子件; 保留面=会话
      TTS B 通道与 L3 表扬, prebuild §2.4 显隐行作废);
   ④ 会话避让监听侧: dialogEvent(dialog open/close)→非必要 HUD 收敛,
      dialog 本体零依赖(T-UI-04 域, 本票只做监听 seam);
   ⑤ 真件集成链: 真 town-interact-core 机器+真 town-ui-core 核心+适配层
      三件在 vm 同笼, 机器 focus/found 事件经 emit 实接线驱动卡片全链;
   ⑦ 集成链 T-UI-02: 真机器 focus→指引出指向→found 回落钟塔→回程收敛
      零残留→再进新机弱提示干净(TOWN_MAP 真锚点同笼, 位姿 poseRef 注入);
   ⑧ 方位指引适配(T-UI-02): 徽章内容/位姿驱动档位/nearby 视野门槛/
      found 回落/签名门控不重建/无位姿降级——L2 槽填充(槽类名不变);
      机器身份快照等价分支直测(回归网: 等价新对象多次 sync 不误判换机);
   ⑨ 可交互高亮/标记与点选反馈(T-UI-03): 高亮层/标记挂载(mount 幂等
      引用恒等)·事件驱动命中(mousemove/pointerdown/pointerup 文档级
      监听, sync 不判命中——架构 §8 口径行为面+源码切片: 无 raycastVoxel/
      零拦截)·按下反馈与点选结算(onInteract 派发, A 侧不代写玩法)·
      found 完成态·签名门控零操作(classList 计数器)·会话降噪(active
      保持/其余隐藏)·降级不炸(无 cam/无监听宿主)·离镇再进卫生·E2E
      真件集成链(真机器+真核心+适配层同笼, TOWN_INTERACTS 真清单)。
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
} catch {
  townUi = null;
}

/* fake DOM 元素 — 工厂唯一来源 test/helpers/fake-dom.js(conventions §7.2)。
   本文件 fakeEl 原是 T-UI 线落地的标准面记录桩原型(适配层许用最小面: 创建/挂树/
   类名/显隐/文本/属性/onclick; S-1 契约: children 是 live 只读集合视图非裸数组,
   F1 契约: 属性闭包私有公开面只走 get/setAttribute; __classOps 计数器做签名门控
   零操作断言)——现连 同款形状的 js/town-ui.js mkHeadlessDoc 一起收编为全仓唯一
   工厂, T-UI-03/04「装具私有小平面被生产照抄」教训的面收敛款。
   文档级监听/注入泵仍在本文件 fakeDoc(文档桩非元素工厂)。 */
const {mkEl} = require('./helpers/fake-dom.js');

function fakeDoc() {
  const body = mkEl('body');
  const listeners = {};
  return {
    body,
    createElement: (tag) => mkEl(tag),
    getElementById: () => null,
    /* 文档级监听记录(T-UI-03 加法扩展): 事件驱动命中的注入泵与摘除断言 */
    addEventListener: (type, fn) => {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener: (type, fn) => {
      const list = listeners[type] || [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    fire: (type, evt) => {
      for (const fn of (listeners[type] || []).slice()) fn(evt || {});
    },
    __listeners: listeners,
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

/* 组装一只被测适配层: deps 全注入(零全局泄漏), 返回记录面+被测件;
   poseRef 可注入位姿采样源(T-UI-02 指引几何输入; 缺省=适配层生产缺省,
   Node 沙盒读不到 voxel 全局 pos/yaw → null) */
function mkHarness(machineRef, poseRef, opts) {
  const o = opts || {};
  const doc = fakeDoc();
  const rec = {speech: fakeSpeech(), timer: fakeTimer(), pages: [],
    sfxKinds: []}; /* TIDEA-18: 音效记录桩(缺省收集, TIDEA-16 bell 断言用) */
  rec.ui = townUi.mkTownUi({
    doc,
    machineRef: machineRef || (() => rec.machine || null),
    speech: rec.speech.speech,
    timer: rec.timer,
    showPage: (id) => rec.pages.push(id),
    poseRef: poseRef,
    sfx: o.sfx === undefined ? (k) => rec.sfxKinds.push(k) : o.sfx,
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

test('进镇出现: 机器在位 sync 即挂 #townHud 三槽 — L2 指引器徽章(T-UI-02) / L4 回菜单钮(左上状态卡已移除, PO 返工 2026-11-15)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const machine = {snapshot: () => ({focusId: null, states: {}})};
  const rec = mkHarness(() => machine);
  assert.strictEqual(rec.ui.root, null, '未进镇不挂载(零常驻 DOM)');
  rec.ui.sync();
  assert.ok(rec.ui.root, '进镇(机器在位)sync 后挂载');
  assert.strictEqual(rec.ui.root.getAttribute('id'), 'townHud',
      '容器 id=townHud(prebuild §1.1)');
  assert.ok(!rec.ui.root.children.some((c) => c.classList.contains('town-hud-card')),
      '左上状态卡不再挂出(PO 返工: 卡壳整体移除)');
  slotOf(rec.ui, 'town-hud-pointer');
  slotOf(rec.ui, 'town-hud-praise');
  slotOf(rec.ui, 'town-hud-sys');
  assert.strictEqual(rec.ui.cardState(), 'idle-exploring',
      '进场且无任务=探索中轻状态(核心态 headless 保留, 无卡 DOM)');
  const pointerSlot = slotOf(rec.ui, 'town-hud-pointer');
  assert.strictEqual(pointerSlot.children.length, 1,
      'L2 指引器徽章就位(T-UI-02: 槽内恰一徽章子件, 不重建不多挂)');
  assert.ok(
      pointerSlot.children[0] &&
      pointerSlot.children[0].classList.contains('town-hud-pointer-badge'),
      '指引器=圆形徽章形态(prebuild §3.1; 槽类名 town-hud-pointer 不变)');
  const sys = slotOf(rec.ui, 'town-hud-sys');
  const home = sys.children.find(
      (c) => c.getAttribute('aria-label') === '回主菜单');
  assert.ok(home, 'L4 默认仅「返回主菜单」图标钮(prebuild §2.1)');
  rec.ui.sync(); /* 同机重复对账幂等 */
  assert.strictEqual(rec.ui.cardState(), 'idle-exploring', '重复 sync 不改核心态');
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

test('emit 接线: focus→核心态进行中; found→完成一步+L3 表扬浮现+停留计时在 U7 窗(卡 DOM 已移除, 态步进与表扬 headless 保留)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const machine = {snapshot: () => ({focusId: 'bell-tower', states: {'bell-tower': 'active'}})};
  const rec = mkHarness(() => machine);
  rec.ui.sync();

  rec.ui.targetEvent('town-ui/target/focus', {target: TARGET});
  assert.strictEqual(rec.ui.cardState(), 'active', 'focus→进行中(验收锚字面)');
  assert.ok(!rec.ui.root.children.some((c) => c.classList.contains('town-hud-card')),
      '卡 DOM 不随 focus 复活(PO 返工: 卡壳整体移除)');

  rec.ui.targetEvent('town-ui/target/update', {id: 'bell-tower', state: 'done'});
  assert.strictEqual(rec.ui.cardState(), 'step-done', 'found→完成一步(验收锚字面)');
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
   ③ TTS 重播入口——随左上状态卡移除撤除(重播钮=卡右端子件, PO 返工
   2026-11-15); 卡话术自动朗读(tts-hint)同步不落地, 保留面=会话 TTS
   (B 侧 dialog 话术)与 L3 表扬, §2.4 显隐行随之作废。
   ============================================================ */

test('L4 回菜单钮: 点选走宿主 chrome 页面缝(showPage(main)), 本票不另造退出链', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  const home = slotOf(rec.ui, 'town-hud-sys')
      .children.find((c) => c.getAttribute('aria-label') === '回主菜单');
  home.click();
  assert.deepStrictEqual(rec.pages, ['main'],
      'L4 挂宿主 chrome(showPage(main), 模式页 back 按钮先例; mkMode 既有语义)');
});

/* ============================================================
   ④ 会话避让监听侧(dialog 本体零依赖, T-UI-04 域)
   ============================================================ */

test('会话避让: dialog open→L2 收敛 L4 保持; close(continue)→恢复; close(done+taskRef)→落完成一步+表扬(L1 卡已移除, 避让语义塌为 L2/L4)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const machine = {snapshot: () => ({focusId: 'bell-tower', states: {'bell-tower': 'active'}})};
  const rec = mkHarness(() => machine);
  rec.ui.sync();
  rec.ui.targetEvent('town-ui/target/focus', {target: TARGET});

  rec.ui.dialogEvent('town-ui/dialog/open', {npcId: 'V01'});
  assert.strictEqual(slotOf(rec.ui, 'town-hud-pointer').hidden, true,
      'dialog open→L2 暂隐(P-H2)');
  assert.strictEqual(slotOf(rec.ui, 'town-hud-sys').hidden, false,
      'L4 保持(安全返回能力不收敛, prebuild §5 函数 2)');

  rec.ui.dialogEvent('town-ui/dialog/close', {result: 'continue'});
  assert.strictEqual(slotOf(rec.ui, 'town-hud-pointer').hidden, false, 'close(continue)→L2 恢复');
  assert.strictEqual(rec.ui.cardState(), 'active', '恢复原态(进行中)');

  rec.ui.dialogEvent('town-ui/dialog/open', {});
  rec.ui.dialogEvent('town-ui/dialog/close', {result: 'done', taskRef: 'task:find-bread'});
  assert.strictEqual(rec.ui.cardState(), 'step-done',
      'close(done+taskRef)→B 播局部完成, A 落常驻完成态(dialog-spec §2.3 宣布权分工)');
  assert.ok(slotOf(rec.ui, 'town-hud-praise').children.length >= 1, '完成伴随表扬浮现');
});

test('会话中意图冻结(轻状态侧): idle-exploring 开会话→found 不弹表扬, focus 不开麦; close 后同事件照给(对照)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  assert.strictEqual(rec.ui.cardState(), 'idle-exploring',
      '前置: 探索中轻状态(核心状态机对 idle-exploring 无 dialog-open 收敛边, 冻结责在装配)');
  rec.ui.dialogEvent('town-ui/dialog/open', {npcId: 'V01'});
  rec.ui.targetEvent('town-ui/target/focus', {target: TARGET});
  assert.deepStrictEqual(rec.speech.spoken, [],
      'focus 零开麦(卡话术 tts-hint 随左上状态卡移除不再落地, PO 返工 2026-11-15; 会话播报优先=B 通道独占)');
  rec.ui.targetEvent('town-ui/target/update', {id: 'task:find-bread', state: 'done'});
  assert.strictEqual(slotOf(rec.ui, 'town-hud-praise').children.length, 0,
      '会话中 found 不弹全局表扬(prebuild §2.5 L3 冻结, 轻状态侧同样生效)');
  rec.ui.dialogEvent('town-ui/dialog/close', {result: 'continue'});
  rec.ui.targetEvent('town-ui/target/update', {id: 'task:find-bread', state: 'done'});
  assert.ok(slotOf(rec.ui, 'town-hud-praise').children.length >= 1,
      'close 后同事件照给(对照: 冻结随会话解除, 非永久静音; 载体=praise-show, tts 载体随卡撤)');
});

/* ============================================================
   ⑤ 接线守门(adventure.js emit 缝最小 diff + index.html 装配序)
   ============================================================ */

test('接线守门: adventure.js 建机步只换 emit 实参(守卫式) — 判据/触发线/建机弃机步零扰动', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'modes', 'adventure.js'), 'utf8');
  assert.ok(src.includes('mkTownTargets({emit:'), '建机步 mkTownTargets 工厂调用在位');
  assert.ok(src.includes('typeof townUiTargetEvent === \'function\''),
      'emit 实参换 townUiTargetEvent 守卫式(town-ui.js 未装载沙盒退回空旁路)');
  assert.ok(src.includes('if (drow === ADV_TOWN_DIM_ROW) advTownInteractBoot();'),
      '建机调用步原样(宿主建机步不动)');
  assert.ok(src.includes('advTownTargets = undefined;'), '弃机步原样(宿主弃机步不动)');
  assert.ok(src.includes('if (pos.z < ADV_TOWN_RETURN_Z) return;'),
      '回程触发线原样(触发线不动)');
});

test('接线守门: index.html 装配序 — css/town.css 链接在位; 四点序 interact-core < ui-core < ui < registry', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(html.includes('css/town.css'), 'css/town.css 链接缺失');
  const atCore = html.indexOf('js/town-interact-core.js');
  const atUiCore = html.indexOf('js/town-ui-core.js');
  const atUi = html.indexOf('js/town-ui.js');
  const atRegistry = html.indexOf('js/mode-registry.js');
  assert.ok(atUiCore >= 0,
      'js/town-ui-core.js script 缺失(浏览器共享词法里适配层双栖解析落 null 分支, 进镇 feed 即炸)');
  assert.ok(atCore >= 0 && atCore < atUiCore && atUiCore < atUi && atUi < atRegistry,
      '装载序四点: town-interact-core < town-ui-core < town-ui < mode-registry(序即依赖)');
});

/* ============================================================
   ⑥ 真件集成链: 真机器+真核心+适配层同笼三件套
      (白闪进镇→HUD 出现→回程→HUD 收敛的 UI 半边全链)
   ============================================================ */

test('集成链: 真 mkTownTargets(emit 实接 townUiTargetEvent) focus/found 全链驱动卡片 — 机器零旁路直通 UI', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  /* vm 同笼: 机器真件(带 TOWN_MAP 依赖链)+核心真件+适配层工厂。
     装具按 index.html 真实装配序装载(装具与它声称守卫的浏览器装配一致):
     集合=本票依赖闭包, 序=index.html 实际 script 序; html 缺席的件不装不补——
     ui-core 缺席时适配层双栖解析落 null 分支→本链红, 守门不被自装补缺弄瞎 */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const closure = ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
    'js/town-map-core.js', 'js/town-assembly-core.js', 'js/town-interact-core.js',
    'js/town-ui-core.js', 'js/town-ui.js'];
  const ordered = closure
      .filter((f) => html.indexOf(f) >= 0)
      .sort((a, b) => html.indexOf(a) - html.indexOf(b));
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ordered) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  /* 复刻 adventure.js 建机步形状: 机器 emit 实接 townUiTargetEvent(守卫同款) */
  vm.runInContext('var __doc = null; var __ui = mkTownUi(' +
      '{machineRef: function() { return __machine || null; }});', ctx);
  vm.runInContext('var __machine = mkTownTargets(' +
      '{emit: function(n, p) { __ui.targetEvent(n, p); }}); __ui.sync();', ctx);

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

/* ============================================================
   ⑦ 集成链 T-UI-02: 方位指引全链(真机器+真核心+适配层同笼,
      TOWN_MAP 真锚点在笼——回落锚/指向几何吃真值)
   ============================================================ */

test('集成链 T-UI-02: 白闪进镇弱提示→真机器 focus 出指向→sync 位姿随动→found 回落钟塔→回程收敛零残留→再进新机弱提示干净', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  /* vm 同笼(⑥ 同款装具): town-map-core 在笼→TOWN_MAP 全局词法在位,
     适配层回落锚/指向几何消费真锚点(bell-tower 79,24,76 / lava-chicken 105,24,79);
     位姿经 poseRef 注入 __pose(模拟 voxel 全局 pos/yaw 同形) */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const closure = ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
    'js/town-map-core.js', 'js/town-assembly-core.js', 'js/town-interact-core.js',
    'js/town-ui-core.js', 'js/town-ui.js'];
  const ordered = closure
      .filter((f) => html.indexOf(f) >= 0)
      .sort((a, b) => html.indexOf(a) - html.indexOf(b));
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ordered) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  const badgeOf = () => vm.runInContext(
      '(function() { var s = __ui.root.children.filter(function(c) { ' +
      'return c.classList.contains("town-hud-pointer"); })[0]; ' +
      'return s.children[0]; })()', ctx);
  vm.runInContext('var __pose = {x: 79, y: 25, z: 96, yaw: 0}; ' +
      'var __machine = null; ' +
      'var __ui = mkTownUi({machineRef: function() { return __machine; }, ' +
      'poseRef: function() { return __pose; }});', ctx);
  /* 白闪进镇(建机同形): 主路上弱提示在位, 指向钟塔回家(锚 79,76: 正前 20 格→near) */
  vm.runInContext('__machine = mkTownTargets(' +
      '{emit: function(n, p) { __ui.targetEvent(n, p); }}); __ui.sync();', ctx);
  let badge = badgeOf();
  assert.ok(badge, '进镇即有指引器徽章(弱提示不缺席)');
  assert.ok(badge.classList.contains('is-fallback'), '进镇无目标=钟塔弱提示(U5 默认)');
  assert.ok(badge.classList.contains('is-front') && badge.classList.contains('band-near'),
      '弱提示指向钟塔方位(面北正前 20 格→front+near, 回家语义保留)');
  /* 真机器 focus(炸鸡店, 锚 105,79): 目标态+方位/距离档吃真锚点 */
  vm.runInContext('__machine.focus(\'lava-chicken\')', ctx);
  badge = badgeOf();
  assert.ok(badge.classList.contains('is-target'), '真机器 focus 事件→目标态');
  const iconEl = badge.children.find((c) => c.classList.contains('town-hud-pointer-icon'));
  assert.ok(iconEl && iconEl.textContent === '🍗',
      '中心图标随目标切换(UI-01 marker 语义键, emoji 占位策略同 L1)');
  assert.ok(badge.classList.contains('is-right') && badge.classList.contains('band-near'),
      '指向几何吃真锚点(主路 79,96 望 105,79: 前右约 57°→right; 约 31 格→near)');
  /* sync 位姿采样: 走近并面向炸鸡店→front+nearby(≤12 格且在视野角内) */
  vm.runInContext('__pose = {x: 101, y: 25, z: 79, yaw: -Math.PI / 2};', ctx);
  vm.runInContext('__ui.sync();', ctx);
  badge = badgeOf();
  assert.ok(badge.classList.contains('is-front') && badge.classList.contains('band-nearby'),
      '位姿采样→档位随动(面东 4 格在视野→nearby, 事件+低频采样驱动非每帧)');
  /* mock found: done 目标不再指→回落钟塔弱提示(验收锚: found 后回落语义) */
  vm.runInContext('__machine.found(\'lava-chicken\')', ctx);
  badge = badgeOf();
  assert.ok(
      badge.classList.contains('is-fallback') &&
      !badge.classList.contains('is-target'),
      'found→done 目标不再指, 回落钟塔弱提示(§5.2/U5 口径)');
  assert.ok(badge.children.find((c) => c.classList.contains('town-hud-pointer-icon'))
      .textContent === '🗼', '回落图标=钟塔(回家/集合锚点语义)');
  /* 回程收敛: 弃机→HUD 收敛 */
  vm.runInContext('__machine = null; __ui.sync();', ctx);
  assert.strictEqual(vm.runInContext('__ui.root.hidden', ctx), true, '回程→HUD 收敛');
  /* 再进新机(远位姿): 弱提示干净重算——第一轮目标零残留(不串轮的指引半边) */
  vm.runInContext('__pose = {x: 140, y: 25, z: 140, yaw: 0};', ctx);
  vm.runInContext('__machine = mkTownTargets(' +
      '{emit: function(n, p) { __ui.targetEvent(n, p); }}); __ui.sync();', ctx);
  badge = badgeOf();
  assert.ok(badge, '再进新机徽章在位');
  assert.ok(!badge.classList.contains('is-target'),
      '第一轮目标零残留(新机新会话, focus/found 不跨轮泄漏)');
  assert.ok(
      badge.classList.contains('is-fallback') &&
      badge.classList.contains('band-far'),
      '新机弱提示按新位姿重算(远处 88 格→far, 签名自进镇重算非陈旧档)');
});

/* ============================================================
   ⑧ 方位指引适配(T-UI-02; prebuild §3.1-§3.4): L2 槽填充的行为面——
      fake DOM 注入装具(mkHarness 第二参 poseRef), 全走槽/徽章/类名 seam。
   ============================================================ */

/* 指引测试用非钟塔目标(与回落图标 🗼 区分, 断言可辨) */
const FARM_TARGET = {id: 'farm', kind: 'landmark', iconKey: 'farm', label: '小农田',
  anchor: {x: 60, y: 24, z: 60}, state: 'active'};

function badgeOf(rec) {
  const slot = slotOf(rec.ui, 'town-hud-pointer');
  const badge = slot.children[0];
  assert.ok(badge, '指引器徽章未挂出(槽内零子件)');
  return badge;
}

function pointerIconOf(badge) {
  return badge.children.find((c) => c.classList.contains('town-hud-pointer-icon'));
}

test('指引器目标指向: 无目标=U5 钟塔弱提示; focus→目标态+图标切换+方位/距离档(位姿注入); sync 位姿采样→档位随动', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  let pose = {x: 61.5, y: 25, z: 76.5, yaw: 0}; /* 面北(voxel 前向 -Z 同式) */
  const rec = mkHarness(() => ({snapshot: () => ({focusId: null, states: {}})}),
      () => pose);
  rec.ui.sync();
  let badge = badgeOf(rec);
  assert.strictEqual(badge.classList.contains('is-fallback'), true,
      '无目标=钟塔弱提示态(U5 belltower-fallback 默认)');
  assert.strictEqual(pointerIconOf(badge).textContent, '🗼',
      '弱提示图标恒钟塔(回家/集合锚点, §5.2 可见性策略)');
  /* 沙盒无 TOWN_MAP(回落锚缺)→弱提示零方位档(不伪造方向) */
  assert.strictEqual(badge.classList.contains('is-front'), false,
      '无回落锚不伪造方位档(核心零依赖, 锚缺席降级为仅图标弱提示)');

  rec.ui.targetEvent('town-ui/target/focus', {target: FARM_TARGET});
  badge = badgeOf(rec);
  assert.strictEqual(badge.classList.contains('is-target'), true,
      'focus→目标态(验收锚: focus 事件驱动指向目标锚点)');
  assert.strictEqual(pointerIconOf(badge).textContent, '🌾',
      '中心图标随目标切换(farm→🌾, UI-01 marker 语义键透传)');
  /* 目标锚(60,60) - 位姿(61.5,76.5): 前偏西约 5°→front; 约 16.6 格→near */
  assert.strictEqual(badge.classList.contains('is-front'), true,
      '方位档=front(目标在前向 ±45° 扇内, 4 方位离散 P-A1)');
  assert.strictEqual(badge.classList.contains('band-near'), true,
      '距离档=near(16.6 格: ≤P_D2 40 且 >P_D1 12)');

  pose = {x: 61.5, y: 25, z: 76.5, yaw: -Math.PI / 2}; /* 转身面东 */
  rec.ui.sync(); /* sync 位姿采样(低频, 非每帧) */
  badge = badgeOf(rec);
  assert.strictEqual(badge.classList.contains('is-left'), true,
      'sync 位姿采样→方位档随动(同一目标转身后换 left)');
  assert.strictEqual(badge.classList.contains('is-front'), false,
      '方位档类互斥(旧档摘除, 不残留)');

  pose = {x: 0, y: 25, z: 0, yaw: 0}; /* 远走: 距锚约 84.9 格 */
  rec.ui.sync();
  badge = badgeOf(rec);
  assert.strictEqual(badge.classList.contains('band-far'), true,
      '距离档=far(>P_D2 40 格, 三档定性不显数字)');

  pose = {x: 61, y: 25, z: 61, yaw: 0}; /* 走近并面向: 距锚 √2 格 */
  rec.ui.sync();
  badge = badgeOf(rec);
  assert.strictEqual(badge.classList.contains('band-nearby'), true,
      '距离档=nearby(≤P_D1 12 格且在视野角内, 「就在附近」态)');
});

test('nearby 档需在视野内(prebuild §5 函数 4): ≤12 格但背对目标→near 不升 nearby(指针仍指引转向)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const pose = {x: 61, y: 25, z: 61, yaw: Math.PI}; /* 踩在锚旁却面南(背对) */
  const rec = mkHarness(() => ({snapshot: () => ({focusId: null, states: {}})}),
      () => pose);
  rec.ui.sync();
  rec.ui.targetEvent('town-ui/target/focus', {target: FARM_TARGET});
  const badge = badgeOf(rec);
  assert.strictEqual(badge.classList.contains('band-near'), true,
      '近距(√2 格)但不在视野角内→near(降档不升 nearby)');
  assert.strictEqual(badge.classList.contains('band-nearby'), false,
      'inView=false 时 nearby 不可达(附近档需在视野内, 鼓励观察世界)');
});

test('found 后回落钟塔弱提示(验收锚 §5.2/U5): done 目标不再指→is-fallback+钟塔图标', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHarness(() => ({snapshot: () => ({focusId: null, states: {}})}),
      () => ({x: 61.5, y: 25, z: 76.5, yaw: 0}));
  rec.ui.sync();
  rec.ui.targetEvent('town-ui/target/focus', {target: FARM_TARGET});
  assert.strictEqual(badgeOf(rec).classList.contains('is-target'), true, '前置: 目标态');
  rec.ui.targetEvent('town-ui/target/update', {id: 'farm', state: 'done'});
  const badge = badgeOf(rec);
  assert.strictEqual(badge.classList.contains('is-fallback'), true,
      'found→done 目标不再指, 回落钟塔弱提示(U5: 无活动目标=钟塔弱提示)');
  assert.strictEqual(badge.classList.contains('is-target'), false, '目标态摘除');
  assert.strictEqual(pointerIconOf(badge).textContent, '🗼',
      '回落图标=钟塔(农场 🌾 已换下, 回家语义保留)');
});

test('签名门控不重建 DOM(架构 §8 签名/脏标刷新): 同目标重复 focus 与同位姿重复 sync→徽章子件引用恒等', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const pose = {x: 61.5, y: 25, z: 76.5, yaw: 0};
  const rec = mkHarness(() => ({snapshot: () => ({focusId: null, states: {}})}),
      () => pose);
  rec.ui.sync();
  rec.ui.targetEvent('town-ui/target/focus', {target: FARM_TARGET});
  const slot = slotOf(rec.ui, 'town-hud-pointer');
  const badge = badgeOf(rec); /* 红期=断言红(徽章未挂出), 不以装具炸代替 */
  const icon = pointerIconOf(badge);
  rec.ui.targetEvent('town-ui/target/focus', {target: FARM_TARGET}); /* 重复同值 */
  assert.strictEqual(slot.children.length, 1, '重复 focus 不多挂子件');
  assert.strictEqual(slot.children[0], badge, '重复 focus 徽章引用恒等(零重建 DOM)');
  assert.strictEqual(pointerIconOf(badge), icon, '图标子件引用恒等(中心不交叉重建)');
  rec.ui.sync(); /* 同位姿重复采样 */
  assert.strictEqual(slot.children[0], badge, '同位姿 sync 徽章引用恒等(签名不变零 DOM 操作)');
  assert.strictEqual(badge.classList.contains('is-front'), true, '档位保持不抖动');
});

test('无位姿/无锚点降级不炸: poseRef 缺省(Node 沙盒 null)→目标态徽章照出, 零方位/距离档, sync 不炸', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync(); /* Node 沙盒: 无 voxel 全局 pos/yaw → 缺省 poseRef null */
  rec.ui.targetEvent('town-ui/target/focus', {target: FARM_TARGET});
  const badge = badgeOf(rec);
  assert.strictEqual(badge.classList.contains('is-target'), true,
      '无位姿目标态徽章照出(指引几何缺输入只降档不炸装配)');
  for (const h of ['is-front', 'is-left', 'is-right', 'is-behind']) {
    assert.strictEqual(badge.classList.contains(h), false,
        '无位姿不得伪造方位档: ' + h);
  }
  for (const b of ['band-far', 'band-near', 'band-nearby']) {
    assert.strictEqual(badge.classList.contains(b), false,
        '无位姿不得伪造距离档: ' + b);
  }
  assert.doesNotThrow(() => rec.ui.sync(), '无位姿 sync 采样不炸(防御缺省)');

  rec.ui.dialogEvent('town-ui/dialog/open', {});
  assert.strictEqual(slotOf(rec.ui, 'town-hud-pointer').hidden, true,
      'L2 会话收敛既有契约不破(T-UI-01 P-H2, 指引内容之上仍收敛)');
});

test('机器身份对账·快照等价分支直测(回归网): machineRef 每调返回等价新对象→多次 sync 不误判换机(零 leave/enter), 卡态/指引器稳定', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  /* machineRef 每调造等价新对象: 引用恒不同、snapshot 输出 JSON 全等——
     直击 sameMachine 快照等价分支(引用恒等快路径全被既有测试走掉,
     本条封「回归为恒 false→每 sync 误判换机 leave+enter」的洞) */
  const rec = mkHarness(
      () => ({snapshot: () => ({focusId: 'farm', states: {farm: 'active'}})}),
      () => ({x: 61.5, y: 25, z: 76.5, yaw: 0}));
  rec.ui.sync(); /* 首次对账: 进场 */
  rec.ui.targetEvent('town-ui/target/focus', {target: FARM_TARGET});
  assert.strictEqual(rec.ui.cardState(), 'active', '前置: 进行中');
  const slot = slotOf(rec.ui, 'town-hud-pointer');
  const badge = slot.children[0];
  assert.ok(badge && badge.classList.contains('is-target'), '前置: 目标态在指');
  const cancelsBefore = rec.speech.cancels;
  const iconBefore = badge.children.find(
      (c) => c.classList.contains('town-hud-pointer-icon'));
  rec.ui.sync(); /* 引用不同+快照全等 → sameMachine 快照等价分支 */
  rec.ui.sync();
  rec.ui.sync();
  assert.strictEqual(rec.ui.cardState(), 'active',
      '卡态稳定(若误判换机: leave→hidden 后 enter 归探索中, active 不复现)');
  assert.strictEqual(rec.speech.cancels, cancelsBefore,
      '零 leave(误判换机必经离镇 speech.cancel, 计数不动=对账未出走)');
  assert.strictEqual(slot.children[0], badge, '徽章引用恒等(签名门控零重建)');
  assert.strictEqual(badge.children.find(
      (c) => c.classList.contains('town-hud-pointer-icon')), iconBefore,
  '图标子件引用恒等(mount 幂等, 对账稳定不重建)');
  assert.strictEqual(badge.classList.contains('is-target'), true,
      '目标态保持(focusTarget/doneIds 不被误清→不回落)');
});

/* ============================================================
   ⑨ 可交互高亮/标记与点选反馈(T-UI-03; prebuild §4.1-§4.4, hud-spec
      §6.1-§6.3): 高亮层 town-hl-layer+标记 town-hl-mark(独立命名空间,
      不占 L1-L4 四槽)。命中判定纯逻辑在 core(⑦ 已直测), 本节锁适配
      行为面: 事件驱动(mousemove/pointerdown/pointerup 文档级监听, sync
      不判命中)+签名门控脏标+会话降噪+点选结算 onInteract(A 侧不代写
      玩法, 观察点/物品类玩法侧消费, A 只看状态回流——prebuild §4.3)。
   ============================================================ */

/* 高亮装具: 机位=广场南主路(79,25,96, 钟塔正前 20 格); cam 形状=
   {origin, dir, yaw, pitch, fovDeg, aspect, vw, vh}(hit 用 origin+dir,
   投影用 yaw/pitch/fovDeg/aspect/vw/vh; 装具造最小面, 适配层不交叉校验
   dir 与 yaw/pitch 一致性)。缺省瞄向正下(脚下无人区, 全员 miss)。 */
const HL_POS = {x: 79, y: 25, z: 96};
const HL_A = {id: 'bell-tower', kind: 'landmark', iconKey: 'belltower',
  label: '钟塔', anchor: {x: 79, y: 24, z: 76}}; /* 正前 20.02 格 */
const HL_B = {id: 'farm', kind: 'landmark', iconKey: 'farm',
  label: '小农田', anchor: {x: 85, y: 24, z: 88}}; /* 前右 10.05 格 */
const HL_C = {id: 'stash', kind: 'prop', iconKey: 'stash',
  label: '秘密小屋', anchor: {x: 0, y: 24, z: 0}}; /* 约 124 格=展示距离门外 */
const HL_FIXTURES = [HL_A, HL_B, HL_C];
const HL_CAM_DEFAULT = {origin: HL_POS, dir: {x: 0, y: -1, z: 0},
  yaw: 0, pitch: 0, fovDeg: 90, aspect: 1, vw: 100, vh: 100};

function hlAimDir(target) {/* 归一化瞄向(装具造输入, 非复算实现) */
  const dx = target.x - HL_POS.x;
  const dy = target.y - HL_POS.y;
  const dz = target.z - HL_POS.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return {x: dx / len, y: dy / len, z: dz / len};
}

function mkHlHarness(machineRef, opts) {
  const o = opts || {};
  const doc = fakeDoc();
  const rec = {speech: fakeSpeech(), timer: fakeTimer(), pages: [], interact: [],
    sfxKinds: []}; /* TIDEA-18: 五槽音效记录桩(缺省收集 kind 供断言) */
  let cam = o.cam === undefined ?
    JSON.parse(JSON.stringify(HL_CAM_DEFAULT)) : o.cam;
  const source = o.hlSource === undefined ? HL_FIXTURES : o.hlSource;
  rec.ui = townUi.mkTownUi({
    doc,
    machineRef: machineRef || (() => rec.machine || null),
    speech: rec.speech.speech,
    timer: rec.timer,
    showPage: (id) => rec.pages.push(id),
    camRef: () => cam,
    hlSource: () => source,
    onInteract: (payload) => rec.interact.push(payload),
    sfx: o.sfx === undefined ? (k) => rec.sfxKinds.push(k) : o.sfx,
  });
  rec.doc = doc;
  rec.fire = (type, evt) => doc.fire(type, evt || {});
  rec.setCam = (c) => {
    cam = c;
  };
  return rec;
}

function hlLayerOf(rec) {
  const hit = rec.ui.root.children.find(
      (c) => c.classList.contains('town-hl-layer'));
  assert.ok(hit, '高亮层未挂出(.town-hl-layer 缺席, T-UI-03)');
  return hit;
}

function markOf(rec, id) {
  const mark = hlLayerOf(rec).children.find(
      (c) => c.getAttribute('data-hl-id') === id);
  assert.ok(mark, '高亮标记未挂出: ' + id);
  return mark;
}

test('高亮层挂载: mount 创建 town-hl-layer+按 hlSource 每条目一标(data-hl-id/图标/is-default); 展示距离门外标记隐藏; 幂等不重建', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHlHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync(); /* 进镇(机器在位)挂载 */
  const layer = hlLayerOf(rec);
  assert.strictEqual(layer.children.length, HL_FIXTURES.length,
      '每条交互对象一标(清单源=hlSource 注入)');
  const mkA = markOf(rec, 'bell-tower');
  assert.strictEqual(mkA.getAttribute('data-hl-id'), 'bell-tower',
      '标记携对象 id 属性(寻址契约)');
  assert.strictEqual(mkA.textContent, '🗼',
      '标记图标随 iconKey(emoji 占位策略同 L1/L2, UI-01 语义键)');
  assert.strictEqual(mkA.classList.contains('is-default'), true,
      '初始默认态(可交互静置低存在感提示, §6.2 默认行)');
  assert.strictEqual(mkA.onclick, null,
      '标记零 onclick(纯视觉层, 点选走文档级事件链)');
  assert.strictEqual(markOf(rec, 'stash').hidden, true,
      '展示距离门外(约 124 格 > 24)标记隐藏(零伪造远标)');
  /* 幂等: 再 sync 标记引用恒等(挂载不重建) */
  const refs = layer.children.slice();
  rec.ui.sync();
  const layer2 = hlLayerOf(rec);
  assert.strictEqual(layer2, layer, '高亮层引用恒等(mount 幂等)');
  /* S-1: children 是 live 只读视图, 展开成序列比元素恒等(语义同前) */
  assert.deepStrictEqual([...layer2.children], refs, '标记子件引用恒等(不重建)');
});

test('事件驱动悬停: mousemove 瞄准命中→is-hover 他标 default; 换瞄互斥切换; 瞄空全 default; sync 改视不判命中(mousemove 才判, 事件驱动口径)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHlHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.setCam(Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(HL_A.anchor)}));
  rec.fire('mousemove', {});
  const mkA = markOf(rec, 'bell-tower');
  assert.strictEqual(mkA.classList.contains('is-hover'), true,
      'mousemove 瞄准钟塔→is-hover(§6.2 悬停态, 鼠标唯一发现通道)');
  assert.strictEqual(markOf(rec, 'farm').classList.contains('is-hover'), false,
      '未瞄准对象不 hover(不可交互区域零误导, §4.6)');
  /* 换瞄互斥: 农场 hover, 钟塔摘 */
  rec.setCam(Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(HL_B.anchor)}));
  rec.fire('mousemove', {});
  assert.strictEqual(markOf(rec, 'farm').classList.contains('is-hover'), true,
      '换瞄农场→farm is-hover');
  assert.strictEqual(mkA.classList.contains('is-hover'), false,
      '旧悬停摘除(互斥切换, 不残留)');
  /* 瞄空(正下脚下无人区): 全 default */
  rec.setCam(JSON.parse(JSON.stringify(HL_CAM_DEFAULT)));
  rec.fire('mousemove', {});
  assert.strictEqual(mkA.classList.contains('is-hover'), false,
      '瞄空→悬停清除(全 default)');
  assert.strictEqual(markOf(rec, 'farm').classList.contains('is-hover'), false,
      '瞄空→农场悬停清除');
  /* 事件驱动口径: 换 aim 但不发事件→sync 不判命中(hover 保持清除态);
     随后 mousemove 才命中——命中判定只挂在鼠标事件上 */
  rec.setCam(Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(HL_A.anchor)}));
  rec.ui.sync();
  assert.strictEqual(mkA.classList.contains('is-hover'), false,
      'sync 改视不判命中(无每帧/无每 sync 命中重算, 架构 §8 事件驱动)');
  rec.fire('mousemove', {});
  assert.strictEqual(mkA.classList.contains('is-hover'), true,
      'mousemove 事件才触发命中重算(悬停随事件到位)');
});

test('架构守门(T-UI-03 源码切片): 文档级三件套监听在册+离镇摘除镜像; 零 raycastVoxel(命中走 core 纯几何); 零拦截(不挡既有输入链)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'town-ui.js'), 'utf8');
  for (const evt of ['mousemove', 'pointerdown', 'pointerup']) {
    assert.ok(src.includes('addEventListener(\'' + evt + '\''),
        '缺 ' + evt + ' 文档级监听(命中检测事件驱动, 禁每帧)');
    assert.ok(src.includes('removeEventListener(\'' + evt + '\''),
        '缺 ' + evt + ' 摘除镜像(离镇卫生, 监听不泄漏)');
  }
  assert.ok(!src.includes('raycastVoxel'),
      'town-ui.js 不得直接 raycast(命中=core townHlHit 纯几何, 非每帧射线)');
  /* F1 守门: 假 DOM 契约面(.attrs)不得泄漏进生产读路径——真实 DOM
     Element 无 .attrs, 标准面=getAttribute; 假 DOM 已双向实现 */
  assert.ok(!/\.attrs/.test(src),
      'town-ui.js 禁直读 .attrs(DOM 标准面=getAttribute, F1 契约面泄漏守门)');
  assert.ok(!/preventDefault|stopPropagation/.test(src),
      '监听零拦截(preventDefault/stopPropagation 会挡挖掘/放置/视角既有链)');
});

test('按下反馈与点选结算: pointerdown→is-pressed(摘 hover); pointerup→onInteract 恰一次派发命中对象' +
    '载荷+pressed 清回 hover; 未悬停按下零反馈零派发', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHlHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.setCam(Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(HL_A.anchor)}));
  rec.fire('mousemove', {});
  const mkA = markOf(rec, 'bell-tower');
  assert.strictEqual(mkA.classList.contains('is-hover'), true, '前置: 悬停在册');
  rec.fire('pointerdown', {});
  assert.strictEqual(mkA.classList.contains('is-pressed'), true,
      'pointerdown→按下态(§6.2 按下行: 确认「系统听到了」)');
  assert.strictEqual(mkA.classList.contains('is-hover'), false,
      '按下摘悬停(优先级 pressed > hover, 序即断言)');
  rec.fire('pointerup', {});
  assert.deepStrictEqual(rec.interact, [
    {id: 'bell-tower', kind: 'landmark', iconKey: 'belltower', label: '钟塔',
      anchor: {x: 79, y: 24, z: 76}},
  ], 'pointerup 命中结算恰一次(onInteract 载荷: id/kind/iconKey/label/anchor)');
  assert.strictEqual(mkA.classList.contains('is-pressed'), false,
      '抬起清按下(回弹)');
  assert.strictEqual(mkA.classList.contains('is-hover'), true,
      '抬起重归悬停(仍在瞄, hover 恢复)');
  /* 未悬停按下: 零反馈零派发(不可交互区域不误导, §4.6) */
  rec.interact.length = 0;
  rec.setCam(JSON.parse(JSON.stringify(HL_CAM_DEFAULT)));
  rec.fire('mousemove', {});
  rec.fire('pointerdown', {});
  assert.strictEqual(mkA.classList.contains('is-pressed'), false,
      '未悬停按下零按下反馈(无命中即无 pressed)');
  rec.fire('pointerup', {});
  assert.deepStrictEqual(rec.interact, [],
      '未悬停点选零派发(空放不结算)');
});

test('点选不动机器(A 侧只看状态回流): 完整点选链后机器 focus/found 零调用(UI 不代写玩法, prebuild §4.3)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const calls = [];
  const machine = {
    snapshot: () => ({focusId: null, states: {}}),
    focus: (id) => calls.push(['focus', id]),
    found: (id) => calls.push(['found', id]),
    reset: () => calls.push(['reset']),
  };
  const rec = mkHlHarness(() => machine);
  rec.ui.sync();
  rec.setCam(Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(HL_A.anchor)}));
  rec.fire('mousemove', {});
  rec.fire('pointerdown', {});
  rec.fire('pointerup', {});
  assert.deepStrictEqual(calls, [],
      '点选链零机器调用(观察点/物品类由玩法侧消费, A 侧只做反馈+状态回流)');
});

test('found 完成态: target/update done→标记 is-done(机器 found/done 对齐)+卡态完成一步+表扬(验收锚); 非会话完成标记可见', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHlHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.ui.targetEvent('town-ui/target/focus', {target: {
    id: 'bell-tower', kind: 'landmark', iconKey: 'belltower', label: '钟塔',
    anchor: {x: 79, y: 24, z: 76}, state: 'active'}});
  rec.ui.targetEvent('town-ui/target/update', {id: 'bell-tower', state: 'done'});
  const mkA = markOf(rec, 'bell-tower');
  assert.strictEqual(mkA.classList.contains('is-done'), true,
      '机器 found/done→标记完成态(§6.2 完成行, 仅正向)');
  assert.strictEqual(mkA.classList.contains('is-hover'), false,
      '完成标记不带悬停态(done 优先级最高, 单向迁移)');
  assert.strictEqual(mkA.hidden, false,
      '非会话完成标记可见(淡化由 CSS opacity 承担, 不硬藏)');
  assert.strictEqual(rec.ui.cardState(), 'step-done',
      'L1 卡同步完成一步(既有链, 与标记完成同源 doneIds)');
  assert.ok(slotOf(rec.ui, 'town-hud-praise').children.length >= 1,
      '完成伴随表扬浮现(零惩罚正向, §4.4)');
});

test('签名门控零操作(架构 §8 脏标口径): 同 aim 重复 mousemove→标记 classList 零调用+引用恒等; 换态才动类', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHlHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.setCam(Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(HL_A.anchor)}));
  rec.fire('mousemove', {});
  const layer = hlLayerOf(rec);
  const refs = layer.children.slice();
  markOf(rec, 'bell-tower'); /* 在册性断言(标记缺席即红, 绑定由 refs/ops 承担) */
  const opsBefore = layer.children.map((c) => ({
    add: c.__classOps.add, remove: c.__classOps.remove}));
  rec.fire('mousemove', {}); /* 同 aim 重复事件 */
  rec.fire('mousemove', {});
  assert.strictEqual(hlLayerOf(rec), layer, '重复事件高亮层引用恒等');
  /* S-1: children 是 live 只读视图, 展开成序列比元素恒等(语义同前) */
  assert.deepStrictEqual([...hlLayerOf(rec).children], refs,
      '重复事件标记引用恒等(零重建 DOM)');
  const opsAfter = layer.children.map((c) => ({
    add: c.__classOps.add, remove: c.__classOps.remove}));
  assert.deepStrictEqual(opsAfter, opsBefore,
      '同态重复事件 classList 零调用(签名不变零 DOM 操作, 无闪烁)');
  /* 换态才动: 瞄农场→农场标 add 调用发生(签名变了) */
  rec.setCam(Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(HL_B.anchor)}));
  rec.fire('mousemove', {});
  const opsB = markOf(rec, 'farm').__classOps;
  assert.ok(opsB.add > 0, '签名变化→类操作发生(脏标翻转)');
});

test('会话降噪: dialog open→选中对象标 is-active 保持可见, 其余标隐藏(off); close→恢复 default 可见(prebuild §4.4 降噪裁决)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHlHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.ui.targetEvent('town-ui/target/focus', {target: {
    id: 'farm', kind: 'landmark', iconKey: 'farm', label: '小农田',
    anchor: {x: 85, y: 24, z: 88}, state: 'active'}});
  const mkA = markOf(rec, 'bell-tower');
  const mkB = markOf(rec, 'farm');
  assert.strictEqual(mkA.hidden, false, '前置: 非会话标记可见');
  rec.ui.dialogEvent('town-ui/dialog/open', {npcId: 'V01'});
  assert.strictEqual(mkB.classList.contains('is-active'), true,
      '会话中选中对象切选中环(§6.2 Active 行, A→B 交接)');
  assert.strictEqual(mkB.hidden, false,
      '选中对象保持可见(选中环保持, townHlDim active=full)');
  assert.strictEqual(mkA.hidden, true,
      '会话中其余可交互隐藏(默认不显示, 降噪=注意力归会话)');
  rec.ui.dialogEvent('town-ui/dialog/close', {result: 'continue'});
  assert.strictEqual(mkA.hidden, false, 'close→其余标记恢复可见');
  assert.strictEqual(mkB.classList.contains('is-active'), false,
      'close→选中环摘除(恢复 default)');
  assert.strictEqual(mkA.classList.contains('is-default'), true,
      '恢复默认态(降噪随会话解除, 非永久静音)');
});

test('降级不炸: camRef null→mousemove 后全标隐藏(零伪造位置); 裸 doc(无 addEventListener 宿主=boot 沙盒形)进镇零监听不炸', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHlHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.setCam(null); /* 无视采样源(生产=CameraRig/camera 缺席守卫回落) */
  rec.ui.sync();
  rec.fire('mousemove', {});
  for (const f of HL_FIXTURES) {
    assert.strictEqual(markOf(rec, f.id).hidden, true,
        '无 cam 全标隐藏(零伪造位置/悬停): ' + f.id);
  }
  assert.doesNotThrow(() => rec.fire('pointerdown', {}) || rec.fire('pointerup', {}),
      '无 cam 按下/抬起不炸(降级全链安全)');
  assert.deepStrictEqual(rec.interact, [], '无 cam 点选零派发(不伪造结算)');
  /* 裸 doc: 无 addEventListener 宿主(vm boot 沙盒头插 doc 形)→不挂监听不炸 */
  const bare = {
    body: mkEl('body'),
    createElement: (tag) => mkEl(tag),
    getElementById: () => null,
  };
  const bareUi = townUi.mkTownUi({
    doc: bare,
    machineRef: () => ({snapshot: () => ({focusId: null, states: {}})}),
  });
  assert.doesNotThrow(() => bareUi.sync(),
      '裸 doc(无监听宿主)进镇不炸(boot 沙盒全放行口径)');
  assert.ok(bareUi.root, '裸 doc 进镇照常挂载(降级只影响监听面)');
});

test('离镇再进卫生: leave→三件套监听摘除+hover/pressed 清零; 再进新标零残留(无 hover/pressed/done 类跨轮泄漏)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHlHarness(); /* 缺省 machineRef 接线=读 rec.machine(换机观察缝) */
  rec.machine = {snapshot: () => ({focusId: null, states: {}})}; /* 预置初机(进镇在位) */
  rec.ui.sync();
  rec.setCam(Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(HL_A.anchor)}));
  rec.fire('mousemove', {});
  rec.fire('pointerdown', {});
  assert.strictEqual(markOf(rec, 'bell-tower').classList.contains('is-pressed'),
      true, '前置: 按下在册');
  const mouseListeners = rec.doc.__listeners.mousemove.length;
  assert.ok(mouseListeners > 0, '前置: mousemove 监听已挂');
  rec.machine = null; /* 离镇(弃机) */
  rec.ui.sync();
  assert.strictEqual(rec.doc.__listeners.mousemove.length, 0,
      '离镇摘 mousemove 监听(不泄漏)');
  assert.strictEqual(rec.doc.__listeners.pointerdown.length, 0,
      '离镇摘 pointerdown 监听');
  assert.strictEqual(rec.doc.__listeners.pointerup.length, 0,
      '离镇摘 pointerup 监听');
  /* 再进新机: 全新标记零残留 */
  rec.machine = {snapshot: () => ({focusId: null, states: {}})};
  rec.ui.sync();
  for (const f of HL_FIXTURES) {
    const mk = markOf(rec, f.id);
    assert.strictEqual(mk.classList.contains('is-hover'), false,
        '再进零悬停残留: ' + f.id);
    assert.strictEqual(mk.classList.contains('is-pressed'), false,
        '再进零按下残留: ' + f.id);
    assert.strictEqual(mk.classList.contains('is-done'), false,
        '再进零完成残留(新机新账): ' + f.id);
  }
});

test('集成链 T-UI-03(T-UI-04F 改约): 进镇九标→mousemove 瞄钟塔位 is-hover' +
    '(同锚并列命中=任务条目)→按下反馈→抬起结算 onInteract→真机器 found is-done' +
    '+完成一步+表扬→回程收敛零残留→再进干净', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  /* vm 同笼(⑥⑦ 同款装具): 真机器+真核心+适配层; hlSource 走生产缺省
     (TOWN_INTERACTS+TOWN_MAP 守卫读), camRef/onInteract 注入; 文档级事件
     经在笼 fake doc 泵(mousemove/pointerdown/pointerup) */
  /* 笼内探针薄包装: ui 闭在 vm 笼内, 层/标只能笼内按类名/属性寻址;
     断言红带信息(层/标缺席=断言红, 不裸炸)——与共享 hlLayerOf 同形 */
  const hlLayerProbe = (context) => {
    const layer = vm.runInContext('__hlLayer()', context);
    assert.ok(layer, '高亮层未挂出(.town-hl-layer 缺席, T-UI-03)');
    return layer;
  };
  const hlMarkProbe = (context, id) => {
    const mark = vm.runInContext('__hlMark(' + JSON.stringify(id) + ')', context);
    assert.ok(mark, '高亮标记未挂出: ' + id);
    return mark;
  };
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const closure = ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
    'js/town-map-core.js', 'js/town-assembly-core.js', 'js/town-interact-core.js',
    'js/town-ui-core.js', 'js/town-ui.js'];
  const ordered = closure
      .filter((f) => html.indexOf(f) >= 0)
      .sort((a, b) => html.indexOf(a) - html.indexOf(b));
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ordered) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  /* 在笼 fake doc(文档级监听宿主+事件泵, 与 harness fakeDoc 同形);
     S-1 契约收紧(2026-11-14): children=live 只读视图(无 pop/push),
     增删唯一通道=appendChild/removeChild(与真元素 HTMLCollection 同面) */
  vm.runInContext(
      'var __listeners = {};\n' +
      'function __liveKids(kids) {\n' +
      '  var methods = {\n' +
      '    item: function(i) { return kids[i]; },\n' +
      '    find: function(fn) { return kids.find(fn); },\n' +
      '    filter: function(fn) { return kids.filter(fn); },\n' +
      '    map: function(fn) { return kids.map(fn); },\n' +
      '    forEach: function(fn) { return kids.forEach(fn); },\n' +
      '    slice: function() { return Array.prototype.slice.apply(kids, arguments); },\n' +
      '    indexOf: function(x) { return kids.indexOf(x); },\n' +
      '    includes: function(x) { return kids.includes(x); }\n' +
      '  };\n' +
      '  return new Proxy(methods, {get: function(t, k) {\n' +
      '    if (k === "length") return kids.length;\n' +
      '    if (typeof k === "string" && /^[0-9]+$/.test(k)) return kids[+k];\n' +
      '    if (k === Symbol.iterator) return function() { return kids[Symbol.iterator](); };\n' +
      '    return t[k];\n' +
      '  }});\n' +
      '}\n' +
      'function __el(tag) {\n' +
      '  var classes = {};\n' +
      '  var attrs = {};\n' + /* 闭包私有: 公开面只走 get/setAttribute(F1) */
      '  var kids = [];\n' +
      '  var view = __liveKids(kids);\n' +
      '  var el = {tag: tag, parent: null, hidden: false,\n' +
      '    get children() { return view; },\n' +
      '    textContent: \'\', style: {}, onclick: null,\n' +
      '    classList: {\n' +
      '      add: function() { for (var i = 0; i < arguments.length; i++) classes[arguments[i]] = true; },\n' +
      '      remove: function() { for (var i = 0; i < arguments.length; i++) delete classes[arguments[i]]; },\n' +
      '      contains: function(c) { return !!classes[c]; }\n' +
      '    },\n' +
      '    setAttribute: function(k, v) { attrs[k] = String(v); },\n' +
      '    getAttribute: function(k) { return attrs[k]; },\n' +
      '    appendChild: function(c) { kids.push(c); c.parent = el; return c; },\n' +
      '    removeChild: function(c) {\n' +
      '      var i = kids.indexOf(c);\n' +
      '      if (i < 0) throw new Error("NotFoundError: removeChild 非子件");\n' +
      '      kids.splice(i, 1); c.parent = null; return c;\n' +
      '    },\n' +
      '    click: function() { if (el.onclick) el.onclick({}); }\n' +
      '  };\n' +
      '  return el;\n' +
      '}\n' +
      'var __doc = {\n' +
      '  body: __el(\'body\'),\n' +
      '  createElement: function(t) { return __el(t); },\n' +
      '  getElementById: function() { return null; },\n' +
      '  addEventListener: function(type, fn) { (__listeners[type] = __listeners[type] || []).push(fn); },\n' +
      '  removeEventListener: function(type, fn) {\n' +
      '    var list = __listeners[type] || [];\n' +
      '    var i = list.indexOf(fn); if (i >= 0) list.splice(i, 1);\n' +
      '  },\n' +
      '  fire: function(type, evt) {\n' +
      '    var list = (__listeners[type] || []).slice();\n' +
      '    for (var i = 0; i < list.length; i++) list[i](evt || {});\n' +
      '  }\n' +
      '};\n' +
      'var __cam = null;\n' +
      'var __interact = [];\n' +
      'var __machine = null;\n' +
      'var __ui = mkTownUi({doc: __doc,\n' +
      '  machineRef: function() { return __machine; },\n' +
      '  camRef: function() { return __cam; },\n' +
      '  onInteract: function(p) { __interact.push(p); }});\n', ctx);
  /* 笼内探针: 层=ui.root 下类名 town-hl-layer; 标=层内 data-hl-id 寻址 */
  vm.runInContext(
      'function __hlLayer() {\n' +
      '  var kids = __ui.root.children;\n' +
      '  for (var i = 0; i < kids.length; i++) {\n' +
      '    if (kids[i].classList.contains("town-hl-layer")) return kids[i];\n' +
      '  }\n' +
      '  return null;\n' +
      '}\n' +
      'function __hlMark(id) {\n' +
      '  var layer = __hlLayer();\n' +
      '  if (!layer) return null;\n' +
      '  var kids = layer.children;\n' +
      '  for (var i = 0; i < kids.length; i++) {\n' +
      '    if (kids[i].getAttribute("data-hl-id") === id) return kids[i];\n' +
      '  }\n' +
      '  return null;\n' +
      '}', ctx);
  /* 白闪进镇: 建机(advTownInteractBoot 同形 emit 实接)→九标在册 */
  vm.runInContext('__machine = mkTownTargets(' +
      '{emit: function(n, p) { __ui.targetEvent(n, p); }}); __ui.sync();', ctx);
  assert.strictEqual(hlLayerProbe(ctx).children.length, 9,
      'TOWN_INTERACTS 九条目(六锚点+三轻任务)一一挂标(生产缺省清单源)');
  assert.strictEqual(hlMarkProbe(ctx, 'bell-tower').textContent, '🗼',
      '钟塔标记图标(UI-01 语义键)');
  assert.strictEqual(hlMarkProbe(ctx, 'bell-tower').classList.contains('is-default'),
      true, '初始默认态(低存在感提示在册)');
  /* 悬停: 机位(79,25,96) 瞄钟塔(79,24,76)——mousemove 事件驱动。
     T-UI-04F 改约(2026-11-14): 同锚并列(bell-tower idx0 与 task:tour-plaza
     idx6 同锚同值)命中裁决=task 前缀条目优先, 悬停载体从钟塔改约为同锚
     任务条目(真清单三处遮挡修复的装配面直接印证; 锁的机制=is-hover 类
     翻转, 断言语义零弱化, 逐 hunk 声明见回执; PO 追认挂条款 9) */
  vm.runInContext('__cam = {origin: {x: 79, y: 25, z: 96}, ' +
      'dir: {x: 0, y: -1 / Math.sqrt(401), z: -20 / Math.sqrt(401)}, ' +
      'yaw: 0, pitch: 0, fovDeg: 90, aspect: 1, vw: 100, vh: 100};', ctx);
  vm.runInContext('__doc.fire("mousemove");', ctx);
  assert.strictEqual(
      hlMarkProbe(ctx, 'task:tour-plaza').classList.contains('is-hover'), true,
      'mousemove 瞄钟塔位→同锚任务 is-hover(并列 task 优先, T-UI-04F 改约)');
  assert.strictEqual(
      hlMarkProbe(ctx, 'bell-tower').classList.contains('is-hover'), false,
      '同锚 landmark 不 hover(改约遮挡生效: 任务接取优先于观察条目)');
  assert.strictEqual(
      hlMarkProbe(ctx, 'lava-chicken').classList.contains('is-hover'), false,
      '未瞄准对象不 hover(炸鸡店在 24 格外, 零误导)');
  /* 按下反馈→抬起结算 */
  vm.runInContext('__doc.fire("pointerdown");', ctx);
  assert.strictEqual(
      hlMarkProbe(ctx, 'task:tour-plaza').classList.contains('is-pressed'), true,
      '按下反馈(E2E 点选反馈验收锚, 载体=命中任务条目)');
  vm.runInContext('__doc.fire("pointerup");', ctx);
  assert.strictEqual(vm.runInContext('__interact.length', ctx), 1,
      '抬起结算恰一次派发');
  assert.strictEqual(vm.runInContext('__interact[0].id', ctx), 'task:tour-plaza',
      '结算载荷=命中对象 id(同锚并列命中任务, T-UI-04F 改约)');
  assert.strictEqual(vm.runInContext('__interact[0].kind', ctx), 'task',
      '结算载荷=可交互类型(dialog-spec §2.2 载荷面)');
  /* A 侧不代写玩法: 点选后机器 focus 仍 null */
  assert.strictEqual(vm.runInContext('__machine.snapshot().focusId', ctx), null,
      '点选不动机器(A 侧只看状态回流)');
  /* 真机器 found→完成态(E2E found 完成态验收锚; 点选谁 found 谁同构搬迁) */
  vm.runInContext('__machine.found(\'task:tour-plaza\');', ctx);
  assert.strictEqual(
      hlMarkProbe(ctx, 'task:tour-plaza').classList.contains('is-done'), true,
      '真机器 found 事件→标记完成态(§6.2 完成行)');
  assert.strictEqual(vm.runInContext('__ui.cardState()', ctx), 'step-done',
      'L1 卡完成一步(机器 done 对齐)');
  /* 回程收敛: 弃机→HUD 收敛+监听摘除+悬停态清零 */
  vm.runInContext('__machine = null; __ui.sync();', ctx);
  assert.strictEqual(vm.runInContext('__ui.root.hidden', ctx), true,
      '回程→HUD 收敛');
  assert.strictEqual(vm.runInContext('__listeners.mousemove.length', ctx), 0,
      '回程→监听摘除零泄漏');
  /* 再进新机: 干净九标(零 hover/pressed/done 残留; 载体=改约后刚 hover/
     found 过的 task:tour-plaza, 保「刚动过的标记再进零残留」原语义强度) */
  vm.runInContext('__machine = mkTownTargets(' +
      '{emit: function(n, p) { __ui.targetEvent(n, p); }}); __ui.sync();', ctx);
  assert.strictEqual(
      hlMarkProbe(ctx, 'task:tour-plaza').classList.contains('is-hover'), false,
      '再进零悬停残留(cam 未变但无事件, 事件驱动口径)');
  assert.strictEqual(
      hlMarkProbe(ctx, 'task:tour-plaza').classList.contains('is-done'), false,
      '再进零完成残留(新机新账, doneIds 清)');
});

/* ============================================================
   ⑩ 会话 UI 三件套与 A/B 接口闭环 (T-UI-04; dialog-spec §2/§4-§7,
      town-ui-dialog-prebuild.md §1-§6): town-dlg- 独立命名空间 DOM
      (World Bubble + Session Panel + Option Chip/Action Ghost, 与四槽+
      hlLayer 并存)。会话驱动缝=点选 sessionKind 在册条目(task 轻任务,
      T-SEAM-04 数据面); landmark/prop 点选保持纯 A 侧结算既有行为零变;
      NPC 实体轻问候走 seam(协议就绪接线留白, 走需求线登记)。B 发出
      dialog/open|update|close→A 既有 dialogEvent 消费全链(同实例闭环);
      会话内表扬归 B(A 意图冻结闸在册, 不双弹); close 按 §2.2/已裁决
      语义恢复(done+taskRef 落完成一步, 其余恢复 prev)。签名门控脏标
      刷新(签名不变零 DOM 操作); 离镇=defer 语义收会话(零负面)。
      红期: index.html 无 town-dialog-core.js、town-ui.js 无 dlg 段→全红。
   ============================================================ */

/* 会话驱动条目(task 轻任务, sessionKind 在册; 形状=townInteractRegistry 快照同形;
   锚点在 HL_POS(79,25,96) 前方 ~14.4 格=命中距离门内) */
const DLG_TASK_SEEK = {id: 'task:find-bread', kind: 'task', iconKey: 'find',
  label: '找面包', anchor: {x: 90, y: 24, z: 84}, state: 'active',
  sessionKind: 'seek', taskRef: 'task:find-bread'};
const DLG_TASK_TOUR = {id: 'task:tour-plaza', kind: 'task', iconKey: 'plaza',
  label: '逛逛广场', anchor: {x: 79, y: 24, z: 76}, state: 'active',
  sessionKind: 'tour', taskRef: 'task:tour-plaza'};
/* 无 sessionKind 条目(landmark): 点选不开会话(A 侧纯结算, 既有行为)。
   锚=独立位(65,24,85): T-UI-04F 命中并列新契约下 LM 与 TOUR 同锚并列
   会被任务恒胜遮挡, 独立锚保「LM 本尊点选」可测(装具造最小面, 非地图
   权威——地图权威在 TOWN_MAP; 断言语义零弱化) */
const DLG_LANDMARK = {id: 'bell-tower', kind: 'landmark', iconKey: 'belltower',
  label: '钟塔', anchor: {x: 65, y: 24, z: 85}, state: 'active'};

/* 同锚 prop 镜像条目(真清单 market prop 与 task:find-bread 同锚且 prop
   源序在前; T-UI-04F 遮挡修复的装配级回归装具, 与 DLG_TASK_SEEK 同锚) */
const DLG_PROP_MARKET = {id: 'market', kind: 'prop', iconKey: 'plaza',
  label: '市集摊位', anchor: {x: 90, y: 24, z: 84}, state: 'active'};

function dlgLayerOf(rec) {
  const hit = rec.ui.root.children.find(
      (c) => c.classList.contains('town-dlg-layer'));
  assert.ok(hit, '会话层未挂出(.town-dlg-layer 缺席, T-UI-04)');
  return hit;
}

function dlgElOf(rec, cls) {
  const scan = (el) => {
    if (el.classList.contains(cls)) return el;
    for (const c of el.children) {
      const hit = scan(c);
      if (hit) return hit;
    }
    return null;
  };
  const hit = scan(dlgLayerOf(rec));
  assert.ok(hit, '会话构件未挂出: .' + cls);
  return hit;
}

/* 开会话便捷: 进镇+瞄向条目+完整点选链(pointerdown/pointerup) */
function dlgHarness(machineRef, source) {
  /* T-UI-04F 改约对齐(2026-11-14): 命中并列新契约=task: 前缀条目优先——
     LM(无 sessionKind)与 TOUR(任务)同锚并列时旧「装具序消歧」失效
     (TOUR 恒胜), 「点选不开会话」须命中 LM 本尊, 故 LM 挪独立锚
     (65,24,85); 缺省表内顺序不再是消歧手段(清单序不表裁决, 断言语义
     零弱化, 逐 hunk 声明见回执) */
  const rec = mkHlHarness(machineRef, {hlSource: source ||
    [DLG_TASK_SEEK, DLG_LANDMARK, DLG_TASK_TOUR]});
  rec.clickEntry = (entry) => {
    rec.setCam(Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(entry.anchor)}));
    rec.fire('mousemove', {});
    rec.fire('pointerdown', {});
    rec.fire('pointerup', {});
  };
  return rec;
}

test('装配守门: index.html 装载序含 town-dialog-core.js 且 ui-core < dialog-core < town-ui(序即依赖)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const atUiCore = html.indexOf('js/town-ui-core.js');
  const atDlgCore = html.indexOf('js/town-dialog-core.js');
  const atUi = html.indexOf('js/town-ui.js');
  assert.ok(atUiCore >= 0, 'town-ui-core 在册(前置)');
  assert.ok(atUi >= 0, 'town-ui 在册(前置)');
  assert.ok(atDlgCore >= 0, 'js/town-dialog-core.js script 缺失(浏览器共享词法' +
    '里核心缺席会话链即断, T-UI-04 装配)');
  assert.ok(atUiCore < atDlgCore && atDlgCore < atUi,
      '装载序 town-ui-core < town-dialog-core < town-ui(核心先于消费方)');
});

test('会话层挂载: mount 恒等创建 town-dlg-layer(bubble/panel 子树)+与四槽/hlLayer 并存; 幂等不重建', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  dlgLayerOf(rec);
  assert.ok(dlgElOf(rec, 'town-dlg-bubble'), 'World Bubble 构件在位');
  const panel = dlgElOf(rec, 'town-dlg-panel');
  assert.ok(panel, 'Session Panel 构件在位');
  assert.strictEqual(panel.getAttribute('data-state'), 'idle',
      '可观测钩子 data-state 初始 idle(dialog-spec §11)');
  assert.strictEqual(panel.hidden, true, '未开会话面板隐藏');
  /* 与既有槽并存(mount 幂等下引用恒等) */
  const layer2ref = dlgLayerOf(rec);
  rec.ui.sync();
  assert.strictEqual(dlgLayerOf(rec), layer2ref, '幂等 sync 零重建(引用恒等)');
  assert.ok(rec.ui.root.children.find((c) => c.classList.contains('town-hud-pointer')),
      '既有槽并存: L2 指引槽在位(L1 卡已移除, PO 返工 2026-11-15)');
  assert.ok(rec.ui.root.children.find((c) => c.classList.contains('town-hl-layer')),
      '既有层并存: hlLayer 在位');
});

test('hover 气泡: 命中可交互条目→Bubble-S 显示(局部提示); 移开→隐; 全程零 dialog 事件(A 不收敛)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  assert.strictEqual(rec.ui.cardState(), 'idle-exploring', '前置: 探索中');
  rec.setCam(Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(DLG_LANDMARK.anchor)}));
  rec.fire('mousemove', {});
  const bubble = dlgElOf(rec, 'town-dlg-bubble');
  assert.strictEqual(bubble.hidden, false, '命中→气泡显示(L0 环境感知)');
  assert.strictEqual(bubble.getAttribute('data-state'), 'bubble', '气泡态在册');
  assert.strictEqual(rec.ui.cardState(), 'idle-exploring',
      'bubble 非会话: A 卡不收敛(prebuild §2.1 bubble 不触发 A)');
  assert.deepStrictEqual(rec.speech.spoken, [], 'bubble 默认不播(矩阵行, 不抢话)');
  rec.setCam(JSON.parse(JSON.stringify(HL_CAM_DEFAULT))); /* 瞄向空地 */
  rec.fire('mousemove', {});
  assert.strictEqual(bubble.hidden, true, '移开→气泡隐(邀请非强迫)');
  assert.strictEqual(rec.ui.cardState(), 'idle-exploring', '往返零 A 动作');
});

test('点选开会话: 点 sessionKind 条目→panel 打开 data-state=seek+自动 route(任务会话)' +
    '+speaker/目标缩略图(B6)/ghost 在位+A 侧收敛(dialog-dimmed)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.clickEntry(DLG_TASK_SEEK);
  const panel = dlgElOf(rec, 'town-dlg-panel');
  assert.strictEqual(panel.hidden, false, '点选→面板打开');
  assert.strictEqual(panel.getAttribute('data-state'), 'seek',
      '任务条目自动 route(点选即接任务, §5.3 场景 2)');
  const speaker = dlgElOf(rec, 'town-dlg-speaker');
  assert.ok(speaker.textContent.includes('找面包'), 'Speaker 身份=条目名(角色即语境)');
  const thumb = dlgElOf(rec, 'town-dlg-thumb');
  assert.strictEqual(thumb.hidden, false, 'B6: seek 态目标缩略图常驻');
  const ghosts = dlgElOf(rec, 'town-dlg-ghosts');
  const ghostText = ghosts.children.map((g) => g.textContent).join('|');
  assert.ok(ghostText.includes('稍后'), '无压力出口「稍后」在位(B5 文案)');
  assert.ok(ghostText.includes('再听'), '「再听一次」在位(§4.4)');
  /* A 侧收敛联动: B open→A dialogEvent→card 收敛 */
  assert.strictEqual(rec.ui.cardState(), 'dialog-dimmed',
      'B 发 open→A 收敛(dialog-dimmed, 闭环同实例)');
  /* TTS: 会话步进自动播一次(B4); A 的 target-focus 提示句被会话冻结吞掉 */
  assert.deepStrictEqual(rec.speech.spoken, ['我们一起来找面包吧!'],
      'B 会话播报独占(A 句被冻结闸吞, dialog-spec §2.2 不抢话)');
});

test('点选不开会话: landmark/prop 条目(无 sessionKind)点选保持纯 A 侧结算(既有行为零变)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.clickEntry(DLG_LANDMARK);
  const panel = dlgElOf(rec, 'town-dlg-panel');
  assert.strictEqual(panel.hidden, true, '无 sessionKind 条目不开会话');
  assert.strictEqual(rec.ui.cardState(), 'active',
      'A 侧结算照常(target-focus→进行中, T-UI-03 既有行为)');
  /* T-UI-04F 改约对齐: anchor 字面量随装具独立锚(65,24,85)同步——断言
     语义零弱化(五键载荷形状与「LM 本尊纯 A 结算」不变, 仅坐标随锚搬迁) */
  assert.deepStrictEqual(rec.interact, [
    {id: 'bell-tower', kind: 'landmark', iconKey: 'belltower', label: '钟塔',
      anchor: {x: 65, y: 24, z: 85}},
  ], 'onInteract 恰一次派发五键(结算面零弱化, 载荷形状=T-UI-03 既有契约)');
});

test('再听一次: ghost 重播当前句零次多播+状态推进归零(data-state 不变)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.clickEntry(DLG_TASK_SEEK);
  const panel = dlgElOf(rec, 'town-dlg-panel');
  const ghosts = dlgElOf(rec, 'town-dlg-ghosts');
  const replay = ghosts.children.find((g) => g.textContent.includes('再听'));
  assert.ok(replay, '前置: 再听 ghost 在位');
  const spokenBefore = rec.speech.spoken.length;
  replay.click();
  assert.strictEqual(rec.speech.spoken.length, spokenBefore + 1,
      '重播恰一次(§6.2 重播当前句)');
  assert.strictEqual(rec.speech.cancels >= 1, true,
      'cancel-then-speak 口径(不重叠抢话, A 侧重播钮同款)');
  assert.strictEqual(panel.getAttribute('data-state'), 'seek',
      '重播不改变状态(§6.2: 不推进)');
});

test('稍后无压力关闭: 任意会话态点稍后→close{deferred}→A 恢复原态+零负面(无表扬无警示)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.ui.targetEvent('town-ui/target/focus', {target: DLG_TASK_SEEK});
  assert.strictEqual(rec.ui.cardState(), 'active', '前置: A 卡进行中(close 恢复基准)');
  rec.clickEntry(DLG_TASK_SEEK);
  assert.strictEqual(rec.ui.cardState(), 'dialog-dimmed', '前置: 会话收敛');
  const ghosts = dlgElOf(rec, 'town-dlg-ghosts');
  const deferBtn = ghosts.children.find((g) => g.textContent.includes('稍后'));
  assert.ok(deferBtn, '前置: 稍后 ghost 在位');
  deferBtn.click();
  assert.strictEqual(rec.ui.cardState(), 'active',
      'close{deferred}→A 恢复 prev(已裁决语义: 非 done 一律恢复)');
  const panel = dlgElOf(rec, 'town-dlg-panel');
  assert.strictEqual(panel.hidden, true, '面板收起');
  assert.strictEqual(dlgElOf(rec, 'town-dlg-praise').hidden, true,
      '零负面: 无表扬浮现(稍后不是失败)');
});

test('seek 全链: 世界点中目标→respond→praise(B 徽章呈现+A 表扬槽零双弹)→autoAdvance→complete→再见→' +
    'close{done+taskRef}→A 落完成一步+错峰表扬', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.clickEntry(DLG_TASK_SEEK);
  assert.strictEqual(dlgElOf(rec, 'town-dlg-panel').getAttribute('data-state'),
      'seek', '前置: seek 态');
  /* 世界点中目标(再点会话锚点条目=确认找到) */
  rec.clickEntry(DLG_TASK_SEEK);
  assert.strictEqual(dlgElOf(rec, 'town-dlg-panel').getAttribute('data-state'),
      'respond', '点中目标→respond(系统确认)');
  rec.timer.fireAll(); /* confirm 短驻泵(300ms 内可感知, §4.1) */
  const panel = dlgElOf(rec, 'town-dlg-panel');
  assert.strictEqual(panel.getAttribute('data-state'), 'praise', 'confirm→praise');
  const praise = dlgElOf(rec, 'town-dlg-praise');
  assert.strictEqual(praise.hidden, false, '会话内表扬呈现(B owner, §7.3)');
  assert.strictEqual(
      rec.ui.root.children.find((c) => c.classList.contains('town-hud-praise'))
          .children.length, 0,
      'A 侧 L3 槽零双弹(会话中意图冻结闸在册)');
  rec.timer.fireAll(); /* praise dwell 泵→next-step→complete */
  assert.strictEqual(panel.getAttribute('data-state'), 'complete',
      'dwell 自动步进→complete(N3 默认)');
  /* [再见]→close{done+taskRef}→A 落完成一步 */
  const opts = dlgElOf(rec, 'town-dlg-opts');
  const bye = opts.children.find((b) => b.textContent.includes('再见'));
  assert.ok(bye, 'complete 出口[再见]在位');
  bye.click();
  assert.strictEqual(rec.ui.cardState(), 'step-done',
      'close{done+taskRef}→A 落常驻完成态(宣布权分工 §2.3)');
  assert.strictEqual(panel.hidden, true, '面板收起(会话终了)');
  assert.strictEqual(
      rec.ui.root.children.find((c) => c.classList.contains('town-hud-praise'))
          .children.length >= 1, true,
      'A 侧完成表扬错峰补位(close 后解冻, 既有会话避让语义)');
  assert.strictEqual(dlgElOf(rec, 'town-dlg-praise').hidden, true,
      'B 会话内表扬随会话收敛(生命周期随会话, §7.3)');
});

test('T-UI-04F done 后命中仍优先任务: 同锚 prop 源序在前, 完成会话再点同锚=重读任务再开' +
    '(命中裁决状态盲不跳变=裁决①; 若做②案 done 摘除回退 prop 则在此红)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}),
      [DLG_PROP_MARKET, DLG_TASK_SEEK]); /* prop 在前=真清单源序镜像 */
  rec.ui.sync();
  /* 前置: 完成一轮——点选接任务→点中目标→praise→complete→再见(done) */
  rec.clickEntry(DLG_TASK_SEEK);
  assert.strictEqual(dlgElOf(rec, 'town-dlg-panel').getAttribute('data-state'),
      'seek', '前置: 同锚并列命中 task 接取(T-UI-04F 遮挡修复)');
  rec.clickEntry(DLG_TASK_SEEK);
  assert.strictEqual(dlgElOf(rec, 'town-dlg-panel').getAttribute('data-state'),
      'respond', '前置: 点中目标');
  rec.timer.fireAll(); /* confirm 短驻泵 */
  assert.strictEqual(dlgElOf(rec, 'town-dlg-panel').getAttribute('data-state'),
      'praise', '前置: confirm→praise');
  rec.timer.fireAll(); /* praise dwell 泵→complete */
  assert.strictEqual(dlgElOf(rec, 'town-dlg-panel').getAttribute('data-state'),
      'complete', '前置: dwell 自动步进→complete');
  const bye = dlgElOf(rec, 'town-dlg-opts').children.find(
      (b) => b.textContent.includes('再见'));
  assert.ok(bye, '前置: complete 出口[再见]在位');
  bye.click();
  assert.strictEqual(rec.ui.cardState(), 'step-done',
      '前置: close{done+taskRef}→A 落完成一步(任务已 done)');
  /* 裁决①锁定: done 后命中裁决状态盲(几何输入不含状态)→再点同锚仍命中
     task→重读会话再开(U6 重播/机器 focus 完成态回看同款无害重玩语义);
     命中稳定不跳变: done 翻转瞬序悬停目标不从 task 跳到同锚 prop */
  rec.clickEntry(DLG_TASK_SEEK);
  assert.strictEqual(dlgElOf(rec, 'town-dlg-panel').getAttribute('data-state'),
      'seek', 'done 后再点=重读任务(会话再开, 无害重玩)');
  const last = rec.interact[rec.interact.length - 1];
  assert.strictEqual(last.id, 'task:find-bread',
      'done 后命中对象恒为 task 条目(②案 done 摘除→prop 可命中在此红)');
  assert.strictEqual(last.kind, 'task',
      '命中对象 kind=task(同锚 prop 观察结算不被降级命中替代)');
});

test('签名门控: 同态重复事件→会话 DOM 零重建(classList 零操作+子件引用恒等)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.clickEntry(DLG_TASK_SEEK);
  const speaker = dlgElOf(rec, 'town-dlg-speaker');
  const panel = dlgElOf(rec, 'town-dlg-panel');
  const opsBefore = Object.assign({}, speaker.__classOps);
  rec.clickEntry(DLG_TASK_SEEK); /* 同条目重复点选: seek pending→target-found */
  /* 会话已开+seek pending: 第二次点中同目标=target-found(§2.2 矩阵) */
  const speaker2 = dlgElOf(rec, 'town-dlg-speaker');
  assert.strictEqual(speaker2, speaker, '面板子件引用恒等(零重建)');
  const opsAfter = Object.assign({}, speaker.__classOps);
  assert.strictEqual(opsAfter.add, opsBefore.add, 'speaker classList 零新增操作');
  assert.strictEqual(opsAfter.remove, opsBefore.remove, 'speaker classList 零移除操作');
  assert.strictEqual(panel.getAttribute('data-state'), 'respond',
      '重复点中同目标=target-found 恰一次(不重复 open, 状态推进到 respond)');
});

test('会话内不双弹: praise 徽章在面板呈现时, 全局 target/found 事件同样零 A 表扬(冻结闸语义保持)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.clickEntry(DLG_TASK_SEEK); /* seek 会话开(dialogOpen=true) */
  rec.ui.targetEvent('town-ui/target/update', {id: 'task:find-bread', state: 'done'});
  assert.strictEqual(
      rec.ui.root.children.find((c) => c.classList.contains('town-hud-praise'))
          .children.length, 0,
      '会话中 found 零全局表扬(既有冻结闸测试同语义, 本票加验面板归 B)');
  assert.strictEqual(dlgElOf(rec, 'town-dlg-praise').hidden, true,
      '无机器 praise 事件时 B 徽章亦不呈现(表扬只随 respond→praise 链)');
});

test('离镇卫生: 会话中弃机→defer 语义收会话(A 收 deferred 恢复)+会话层收敛+再进零残留', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  let machine = {snapshot: () => ({focusId: null, states: {}})};
  const rec = dlgHarness(() => machine);
  rec.ui.sync();
  rec.clickEntry(DLG_TASK_SEEK);
  assert.strictEqual(rec.ui.cardState(), 'dialog-dimmed', '前置: 会话中');
  machine = null;
  rec.ui.sync();
  assert.strictEqual(rec.ui.cardState(), 'idle-exploring',
      '弃机→A 收 deferred 恢复(探索中, 零惩罚无残留)');
  assert.strictEqual(dlgElOf(rec, 'town-dlg-panel').hidden, true, '面板收起');
  assert.strictEqual(rec.ui.root.hidden, true, 'HUD 容器收敛(既有语义)');
  machine = {snapshot: () => ({focusId: 'bell-tower', states: {'bell-tower': 'active'}})};
  rec.ui.sync();
  assert.strictEqual(dlgElOf(rec, 'town-dlg-panel').getAttribute('data-state'),
      'idle', '再进新机: 会话态零残留(机器复位干净)');
  assert.strictEqual(
      rec.speech.spoken.filter((s) => s.includes('找面包')).length, 1,
      '会话播报零跨轮重播(会话可重入, B4 autoPerStep=once)');
});

test('CSS 守门切片: town.css 含 --town-dlg- token 段(热区 44/64+panel 底部安全区+动效窗)' +
    '+零警示红(#f00/#ff0000/red 禁入)+克制动效降级在册', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const css = fs.readFileSync(path.join(ROOT, 'css', 'town.css'), 'utf8');
  assert.ok(css.includes('--town-dlg-panel-bg'), 'B 侧 token 段在册(panel-bg)');
  assert.ok(css.includes('--town-dlg-chip-size'), 'chip 触点 token(B1/§4.2)');
  assert.ok(css.includes('--town-dlg-panel-bottom'), 'panel 底部安全区 token(B1)');
  assert.ok(/\.town-dlg-chip\s*\{[^}]*64/.test(css), 'chip 触点 64px(§4.2 主选项)');
  assert.ok(/\.town-dlg-ghost\s*\{[^}]*44/.test(css),
      'ghost 热区 ≥44px(§4.5 硬约束, 纯鼠标)');
  assert.ok(!/#f00\b|#ff0000|:\s*red\b/i.test(css),
      '零警示红(§6.3: 无红叉; Market Red 仅 #d96b52 温暖点缀)');
  assert.ok(css.includes('prefers-reduced-motion'),
      '克制动效降级在册(零闪烁惊吓, §4.5)');
  /* 双蓝澄清(prebuild §1.2, F2 2026-11-14): B 侧会话引导=村民盘 Sky
     Cloth #7EC8D8, A 侧 HUD=建筑盘布幔-天蓝 #7EC8E3 — 分属两套色盘,
     实现不得把两值当同义名互换 */
  assert.ok(css.includes('--town-dlg-guide: #7ec8d8'),
      'B 侧引导 token --town-dlg-guide: #7ec8d8 在册(prebuild §1.2 村民盘)');
  const thumbAt = css.indexOf('.town-dlg-thumb');
  const thumbBlock = css.slice(thumbAt, css.indexOf('}', thumbAt));
  assert.ok(thumbBlock.includes('var(--town-dlg-guide)'),
      'thumb 引导色走 B 侧自有 token var(--town-dlg-guide)');
  assert.ok(!thumbBlock.includes('--town-hud-sky'),
      'thumb 不得引用 A 侧 --town-hud-sky(双蓝不得互换, F2)');
});

test('源文本守门(S-1): js/town-ui.js 的 .children 上不得直接调数组方法' +
    '(HTMLCollection 陷阱, 2026-11-14 阻断级评审教训)', () => {
  /* 真浏览器 element.children 是 live HTMLCollection: 既无 pop/push 等
     变更法, 也无 filter/map 等读法 — clearChildren 直调 children.pop 在
     真机上每次调用即 TypeError(任务会话二次渲染断链/关闭链面板隐藏分支
     炸→dlgPraise 🌟 残留屏上); 假 doc 的 children 是纯数组时行为测试
     全绿零感知, 故装具面已收紧为 live 只读视图(liveKids), 源文本一并
     锁死: .children 上的数组方法直调一律禁止(增删走 appendChild/
     removeChild, 遍历走 for-of/length/索引), 仿 math-paradigms 守门先例 */
  const src = fs.readFileSync(path.join(ROOT, 'js', 'town-ui.js'), 'utf8');
  const bad = src.match(new RegExp(
      '\\.children\\.(?:pop|push|shift|unshift|splice|filter|forEach|map|some|every' +
      '|reduce|reduceRight|find|findIndex|findLast|findLastIndex|includes|indexOf' +
      '|join|slice|concat|sort|reverse|flat|flatMap|fill|copyWithin|at' +
      '|entries|keys|values)\\(', 'g'));
  assert.ok(!bad, '.children 是 live 集合视图: 数组方法直调禁止' +
      '(增删走 appendChild/removeChild), 命中: ' + bad);
});

test('E2E 集成链 T-UI-04: 真四件同笼(镜像 index.html 装载序)进镇→点选接任务→seek→点中目标→' +
    'praise→complete→close→A 恢复(全链零旁路)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  /* vm 同笼: 装具按 index.html 真实装配序装载(含本票 town-dialog-core.js) */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const closure = ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
    'js/town-map-core.js', 'js/town-assembly-core.js', 'js/town-interact-core.js',
    'js/town-ui-core.js', 'js/town-dialog-core.js', 'js/town-ui.js'];
  const ordered = closure
      .filter((f) => html.indexOf(f) >= 0)
      .sort((a, b) => html.indexOf(a) - html.indexOf(b));
  assert.ok(ordered.includes('js/town-dialog-core.js'),
      'town-dialog-core.js 在 index.html 装配(守门先行)');
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ordered) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  /* 真注册清单(九条目含 task:find-bread sessionKind=seek); 真机+真时器桩;
     doc=带 fire 的最小事件宿主桩(文档级点选链驱动, 镜像 mkHlHarness 装具面;
     classList/attrs 真实记录——裁决修复 2026-11-14: 恒假 stub 使 panelState
     恒 'none', 四断言恒红, 系装具缺陷非实现缺陷) */
  vm.runInContext(
      'var __doc = (function() {' +
      'var listeners = {}; var listenersOf = function(t) {' +
      'return listeners[t] || []; };' +
      /* S-1 契约收紧(2026-11-14): children=live 只读视图(无 pop/push),
         增删唯一通道=appendChild/removeChild(真元素 HTMLCollection 同面) */
      'var liveKids = function(kids) {' +
      'var methods = {item: function(i) { return kids[i]; },' +
      'find: function(fn) { return kids.find(fn); },' +
      'filter: function(fn) { return kids.filter(fn); },' +
      'map: function(fn) { return kids.map(fn); },' +
      'forEach: function(fn) { return kids.forEach(fn); },' +
      'slice: function() { return Array.prototype.slice.apply(kids, arguments); },' +
      'indexOf: function(x) { return kids.indexOf(x); },' +
      'includes: function(x) { return kids.includes(x); }};' +
      'return new Proxy(methods, {get: function(t, k) {' +
      'if (k === "length") return kids.length;' +
      'if (typeof k === "string" && /^[0-9]+$/.test(k)) return kids[+k];' +
      'if (k === Symbol.iterator) return function() { return kids[Symbol.iterator](); };' +
      'return t[k]; }}); };' +
      'var mkEl = function(tag) { var classes = []; var attrs = {};' +
      'var kids = []; var view = liveKids(kids);' +
      'return {tag: tag, parent: null, hidden: false,' +
      'get children() { return view; },' +
      'textContent: "", style: {}, onclick: null,' +
      'classList: {add: function() { for (var i = 0; i < arguments.length; i++) {' +
      'if (classes.indexOf(arguments[i]) < 0) classes.push(arguments[i]); } },' +
      'remove: function() { for (var i = 0; i < arguments.length; i++) {' +
      'var k = classes.indexOf(arguments[i]); if (k >= 0) classes.splice(k, 1); } },' +
      'contains: function(c) { return classes.indexOf(c) >= 0; }},' +
      'setAttribute: function(k, v) { attrs[k] = String(v); },' +
      'getAttribute: function(k) { return k in attrs ? attrs[k] : null; },' +
      'appendChild: function(c) { kids.push(c); },' +
      'removeChild: function(c) { var i = kids.indexOf(c);' +
      'if (i < 0) { throw new Error("NotFoundError: removeChild 非子件"); }' +
      'kids.splice(i, 1); return c; },' +
      'click: function() { if (this.onclick) this.onclick({}); }}; };' +
      'var body = mkEl("body");' +
      'return {body: body, createElement: mkEl, getElementById: function() {' +
      'return null; }, addEventListener: function(t, fn) {' +
      '(listeners[t] = listeners[t] || []).push(fn); },' +
      'removeEventListener: function(t, fn) { var l = listeners[t] || [];' +
      'var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },' +
      'fire: function(t) { var l = listenersOf(t).slice();' +
      'for (var i = 0; i < l.length; i++) l[i]({}); }}; })();' +
      'var __timer = {pending: [], set: function(fn, ms) {' +
      'var h = {fn: fn, ms: ms}; this.pending.push(h); return h; },' +
      'clear: function(h) { var i = this.pending.indexOf(h);' +
      'if (i >= 0) this.pending.splice(i, 1); }};' +
      'var __ui = mkTownUi({doc: __doc,' +
      'machineRef: function() { return __machine || null; },' +
      /* hlSource 注入过滤清单(消真注册清单同锚点歧义: market(prop) 与
         task:find-bread(task) 同在 market 锚, 角度并列按源序裁决命中
         market→不开会话; 裁决修复 2026-11-14, 歧义事实登记回执):
         协议链全真(真条目快照/真状态机/真装配), 仅清单取单条消歧 */
      'hlSource: function() { return townInteractRegistry(TOWN_INTERACTS)' +
      '.filter(function(e) { return e.id === "task:find-bread"; }); },' +
      'camRef: function() { return __cam || null; }, timer: __timer});' +
      'var __cam = null; var __machine = mkTownTargets({emit: function(n, p) {' +
      '__ui.targetEvent(n, p); }}); __ui.sync();', ctx);
  const state = () => vm.runInContext('__ui.cardState()', ctx);
  assert.strictEqual(state(), 'idle-exploring', '进镇探索中');
  /* 瞄向真条目 task:find-bread 锚点(market 摊位)后完整点选链 */
  vm.runInContext(
      'var __aim = TOWN_INTERACTS.find(function(e) { return e.id === "task:find-bread"; });' +
      'var __a = townInteractRegistry([__aim])[0];' +
      'var __o = {x: __a.anchor.x, y: __a.anchor.y + 1, z: __a.anchor.z + 14};' +
      'var __d = {x: __a.anchor.x - __o.x, y: __a.anchor.y - __o.y, z: __a.anchor.z - __o.z};' +
      'var __len = Math.sqrt(__d.x * __d.x + __d.y * __d.y + __d.z * __d.z);' +
      '__cam = {origin: __o, dir: {x: __d.x / __len, y: __d.y / __len, z: __d.z / __len},' +
      'yaw: 0, pitch: 0, fovDeg: 90, aspect: 1, vw: 100, vh: 100};', ctx);
  vm.runInContext('__doc.fire("mousemove"); __doc.fire("pointerdown");' +
      '__doc.fire("pointerup");', ctx);
  const panelState = () => vm.runInContext(
      '(function() { var scan = function(el) { if (el.classList.contains' +
      '("town-dlg-panel")) return el; for (var i = 0; i < el.children.length; i++) {' +
      'var hit = scan(el.children[i]); if (hit) return hit; } return null; };' +
      'var p = scan(__ui.root); return p ? p.getAttribute("data-state") : "none"; })()',
      ctx);
  assert.strictEqual(state(), 'dialog-dimmed', '点选接任务→B open→A 收敛(全链)');
  assert.strictEqual(panelState(), 'seek', '自动 route→seek(真 sessionKind 数据面)');
  /* 世界点中目标(再点同条目)→respond→泵 confirm→praise→泵 dwell→complete→再见 */
  vm.runInContext('__doc.fire("pointerdown"); __doc.fire("pointerup");', ctx);
  assert.strictEqual(panelState(), 'respond', '点中目标→respond');
  /* 泵=fireAll 语义(快照先行, 泵中新注册句柄留待下次泵——confirm 280ms 到期
     发 praise 并注册 dwell 1200ms; 两泵两时刻) */
  vm.runInContext('(function() { var l = __timer.pending.slice();' +
      '__timer.pending = []; for (var i = 0; i < l.length; i++) l[i].fn(); })()', ctx);
  assert.strictEqual(panelState(), 'praise', 'confirm→praise(徽章呈现)');
  vm.runInContext('(function() { var l = __timer.pending.slice();' +
      '__timer.pending = []; for (var i = 0; i < l.length; i++) l[i].fn(); })()', ctx);
  assert.strictEqual(panelState(), 'complete', 'dwell 自动步进→complete');
  vm.runInContext(
      '(function() { var scan = function(el, cls) { if (el.classList.contains(cls))' +
      'return el; for (var i = 0; i < el.children.length; i++) { var hit =' +
      'scan(el.children[i], cls); if (hit) return hit; } return null; };' +
      'var opts = scan(__ui.root, "town-dlg-opts"); var bye = null;' +
      'for (var i = 0; i < opts.children.length; i++) {' +
      'if (opts.children[i].textContent.indexOf("再见") >= 0) bye = opts.children[i]; }' +
      'bye.click(); })()', ctx);
  assert.strictEqual(state(), 'step-done',
      'close{done+taskRef}→A 落完成一步(全链闭环收口)');
  assert.strictEqual(panelState() === 'idle' || panelState() === 'none', true,
      '面板收起(会话终了, 机器回 idle)');
});

/* ============================================================
   T-UI-04F 真清单点选 E2E(票面施工内容 3): vm 同笼真注册清单(不过滤)。
   T-UI-04 E2E 的过滤清单消歧(在册勿动)是同锚遮挡歧义的临时绕行, 本测
   是该歧义(登记于其票回执)的正解回归: 真清单源序下三处 task 条目被同
   锚 prop/landmark 遮挡(tour-plaza@钟塔 / find-bread@market /
   visit-stash@stash), 逐锚断言点选 task 锚→会话开启全链(sessionKind
   载荷正确+命中对象=task 条目本尊)。
   红相: 现命中契约按源序裁决→三锚全被同锚条目遮挡→点选不开会话全红。
   ============================================================ */

/* 真清单同笼装具: 镜像 T-UI-04 E2E(index.html 装载序+liveKids doc 桩),
   唯二差异=hlSource 真清单全量不过滤+onInteract 结算记录(命中对象断言面);
   每次调用新 ctx(三锚互不污染, 会话无需跨锚收口) */
function realTownCtx() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const closure = ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
    'js/town-map-core.js', 'js/town-assembly-core.js', 'js/town-interact-core.js',
    'js/town-ui-core.js', 'js/town-dialog-core.js', 'js/town-ui.js'];
  const ordered = closure
      .filter((f) => html.indexOf(f) >= 0)
      .sort((a, b) => html.indexOf(a) - html.indexOf(b));
  assert.ok(ordered.includes('js/town-dialog-core.js'),
      'town-dialog-core.js 在 index.html 装配(守门先行)');
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ordered) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(
      'var __doc = (function() {' +
      'var listeners = {}; var listenersOf = function(t) {' +
      'return listeners[t] || []; };' +
      /* S-1 契约(2026-11-14): children=live 只读视图, 增删唯一通道=
         appendChild/removeChild(镜像 T-UI-04 E2E 同款桩, 装具纪律 #12) */
      'var liveKids = function(kids) {' +
      'var methods = {item: function(i) { return kids[i]; },' +
      'find: function(fn) { return kids.find(fn); },' +
      'filter: function(fn) { return kids.filter(fn); },' +
      'map: function(fn) { return kids.map(fn); },' +
      'forEach: function(fn) { return kids.forEach(fn); },' +
      'slice: function() { return Array.prototype.slice.apply(kids, arguments); },' +
      'indexOf: function(x) { return kids.indexOf(x); },' +
      'includes: function(x) { return kids.includes(x); }};' +
      'return new Proxy(methods, {get: function(t, k) {' +
      'if (k === "length") return kids.length;' +
      'if (typeof k === "string" && /^[0-9]+$/.test(k)) return kids[+k];' +
      'if (k === Symbol.iterator) return function() { return kids[Symbol.iterator](); };' +
      'return t[k]; }}); };' +
      'var mkEl = function(tag) { var classes = []; var attrs = {};' +
      'var kids = []; var view = liveKids(kids);' +
      'return {tag: tag, parent: null, hidden: false,' +
      'get children() { return view; },' +
      'textContent: "", style: {}, onclick: null,' +
      'classList: {add: function() { for (var i = 0; i < arguments.length; i++) {' +
      'if (classes.indexOf(arguments[i]) < 0) classes.push(arguments[i]); } },' +
      'remove: function() { for (var i = 0; i < arguments.length; i++) {' +
      'var k = classes.indexOf(arguments[i]); if (k >= 0) classes.splice(k, 1); } },' +
      'contains: function(c) { return classes.indexOf(c) >= 0; }},' +
      'setAttribute: function(k, v) { attrs[k] = String(v); },' +
      'getAttribute: function(k) { return k in attrs ? attrs[k] : null; },' +
      'appendChild: function(c) { kids.push(c); },' +
      'removeChild: function(c) { var i = kids.indexOf(c);' +
      'if (i < 0) { throw new Error("NotFoundError: removeChild 非子件"); }' +
      'kids.splice(i, 1); return c; },' +
      'click: function() { if (this.onclick) this.onclick({}); }}; };' +
      'var body = mkEl("body");' +
      'return {body: body, createElement: mkEl, getElementById: function() {' +
      'return null; }, addEventListener: function(t, fn) {' +
      '(listeners[t] = listeners[t] || []).push(fn); },' +
      'removeEventListener: function(t, fn) { var l = listeners[t] || [];' +
      'var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },' +
      'fire: function(t) { var l = listenersOf(t).slice();' +
      'for (var i = 0; i < l.length; i++) l[i]({}); }}; })();' +
      'var __timer = {pending: [], set: function(fn, ms) {' +
      'var h = {fn: fn, ms: ms}; this.pending.push(h); return h; },' +
      'clear: function(h) { var i = this.pending.indexOf(h);' +
      'if (i >= 0) this.pending.splice(i, 1); }};' +
      'var __interact = [];' +
      'var __ui = mkTownUi({doc: __doc,' +
      'machineRef: function() { return __machine || null; },' +
      /* T-UI-04F 正解回归: 真清单全量不过滤(与 T-UI-04 E2E 唯一装具分歧) */
      'hlSource: function() { return townInteractRegistry(TOWN_INTERACTS); },' +
      'camRef: function() { return __cam || null; }, timer: __timer,' +
      'onInteract: function(p) { __interact.push(p); }});' +
      'var __cam = null; var __machine = mkTownTargets({emit: function(n, p) {' +
      '__ui.targetEvent(n, p); }}); __ui.sync();' +
      '__panelState = function() { var scan = function(el) {' +
      'if (el.classList.contains("town-dlg-panel")) return el;' +
      'for (var i = 0; i < el.children.length; i++) { var hit = scan(el.children[i]);' +
      'if (hit) return hit; } return null; };' +
      'var p = scan(__ui.root); return p ? p.getAttribute("data-state") : "none"; };',
      ctx);
  return ctx;
}

test('E2E 真清单点选 T-UI-04F: 不过滤真注册清单三处同锚遮挡逐锚断言——点 task 锚→会话开启' +
    '(sessionKind 载荷正确)+命中对象=task 本尊', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  /* 三遮挡锚位(TOWN_INTERACTS 源序: prop/landmark 恒在同名锚 task 条目前):
     bell-tower(idx0)→task:tour-plaza(idx6) · market(idx4)→task:find-bread(idx7)
     · stash(idx5)→task:visit-stash(idx8)。
     panelState=route 矩阵形态(ROUTE_BY_KIND={tour:'guide',seek:'seek',help:
     'help'}, town-dialog-core.js 在库契约, 其同名单测钉死['tour','guide',
     'tour'])——面板 data-state 是 dialog 机 state 非裸 sessionKind,
     红方首版误把两者画等号(绿方打回裁决修正, 观测面改约非弱化):
     sessionKind 载荷正确由「route 只认 sessionKind 才达对应形态」证明 */
  const occlusions = [
    {taskId: 'task:tour-plaza', panelState: 'guide', label: '逛逛广场'},
    {taskId: 'task:find-bread', panelState: 'seek', label: '找面包'},
    {taskId: 'task:visit-stash', panelState: 'seek', label: '探秘小屋'},
  ];
  for (const occ of occlusions) {
    const ctx = realTownCtx();
    const run = (expr) => vm.runInContext(expr, ctx);
    assert.strictEqual(run('__ui.cardState()'), 'idle-exploring',
        occ.taskId + ': 前置 进镇探索中(真清单同笼装配完成)');
    /* 瞄向真条目真锚(锚前 ~14.04 格, 距离/角度双门内正中, 镜像 T-UI-04 E2E) */
    run('var __aim = townInteractRegistry(TOWN_INTERACTS).find(function(e) { ' +
        'return e.id === ' + JSON.stringify(occ.taskId) + '; });' +
        'var __o = {x: __aim.anchor.x, y: __aim.anchor.y + 1, z: __aim.anchor.z + 14};' +
        'var __d = {x: __aim.anchor.x - __o.x, y: __aim.anchor.y - __o.y, ' +
        'z: __aim.anchor.z - __o.z};' +
        'var __len = Math.sqrt(__d.x * __d.x + __d.y * __d.y + __d.z * __d.z);' +
        '__cam = {origin: __o, dir: {x: __d.x / __len, y: __d.y / __len, ' +
        'z: __d.z / __len}, yaw: 0, pitch: 0, fovDeg: 90, aspect: 1, ' +
        'vw: 100, vh: 100};');
    run('__doc.fire("mousemove"); __doc.fire("pointerdown"); __doc.fire("pointerup");');
    assert.strictEqual(run('__ui.cardState()'), 'dialog-dimmed',
        occ.taskId + '(' + occ.label + '): 点选接任务→B open→A 收敛(真清单全链)');
    assert.strictEqual(run('__panelState()'), occ.panelState,
        occ.taskId + ': 自动 route→' + occ.panelState +
        '(sessionKind 载荷正确: tour→guide/seek→seek 矩阵形态)');
    assert.strictEqual(run('__interact.length'), 1,
        occ.taskId + ': 恰一次结算派发');
    assert.strictEqual(run('__interact[0].id'), occ.taskId,
        occ.taskId + ': 命中对象=task 条目本尊(非同锚 prop/landmark 遮挡)');
  }
});

/* ============================================================
   T-UI-05 红锚(交付物 3 默认值落地; 纯追加, 既有断言零触碰)
   ============================================================ */

/* F5 消解(PO 待裁条款 8): praise 句被 dwell 步进 speech.cancel() 截断——
   dwell 默认取 praiseTotalMs[1] 上限 2000ms(表扬句完整可听再步进);
   参数表本身 [1200,2000] 锁不动, 取值点=装配层 dlgDwellMs 单一处 */
test('T-UI-05 F5: praise dwell 泵默认取 praiseTotalMs 上限档(表扬句完整播完再步进, 不被 cancel 截断)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  rec.clickEntry(DLG_TASK_SEEK); /* 点选接任务→seek */
  rec.clickEntry(DLG_TASK_SEEK); /* 世界点中目标→respond */
  rec.timer.fireAll(); /* confirm 短驻泵→praise→dwell 泵入册 */
  assert.strictEqual(dlgElOf(rec, 'town-dlg-panel').getAttribute('data-state'),
      'praise', '前置: confirm→praise');
  assert.strictEqual(rec.timer.pending.length, 1,
      'praise 态在册定时恰一只(dwell 泵; 会话中 A 侧表扬冻结零额外定时)');
  assert.strictEqual(rec.timer.pending[0].ms, 2000,
      'dwell 默认=praiseTotalMs[1] 上限档(F5: 1.2s 下限档截断表扬句 cancel-then-speak)');
});

/* ============================================================
   城镇翻新波次二(TIDEA-14/16 呈现层两件; 提案源 hud-ideas U-03/U-08):
   世界气泡锚定说话人头顶投影/回望钟塔一次性回礼脉冲。TIDEA-19 首访轻
   引导随左上状态卡移除撤除(PO 返工 2026-11-15, 见 L2021 撤除注)。全走
   公共 seam(注入 camRef/poseRef/timer + 文档级事件泵), 纯追加既有断言
   零触碰。
   ============================================================ */

test('TIDEA-14 世界气泡锚定: hover 说话人→气泡挂头顶投影位(is-anchored+内联 left/top, 安全区夹紧); 相机转走→sync 采样重投影回落底部固定位(摘类清内联, 气泡仍显)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = mkHlHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  const bubble = dlgElOf(rec, 'town-dlg-bubble');
  assert.strictEqual(bubble.hidden, true, '未悬停不显示(idle+hoveredEntry 双门)');
  /* 瞄准钟塔(正前 20 格)→mousemove 命中→气泡显+锚定位写入
     (装具投影: cam(79,25,96) yaw0 fov90 vw/vh100, 锚(79,24,76)→屏
     (50,53); offsetWidth 假 DOM 缺席→0, 夹紧窗 [16,84] 不吃 50) */
  rec.setCam(Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(HL_A.anchor)}));
  rec.fire('mousemove', {});
  assert.strictEqual(bubble.hidden, false, '悬停说话人→气泡显(环境感知局部提示)');
  assert.strictEqual(bubble.classList.contains('is-anchored'), true,
      '锚定档类在位(世界锚定, 尾尖指向说话人)');
  assert.strictEqual(bubble.style.left, '50px',
      '投影 x=50(vw100 水平中心, 夹紧窗内原值直写)');
  assert.strictEqual(bubble.style.top, '41px',
      '投影 y=53 上移 GAP 12=头顶悬停(底边停在锚点上方)');
  /* 相机背转(锚入背后→depth≤0 投影缺席)→不发 mousemove(hover 记忆在)→
     sync 250ms 采样半边重投影→回落底部固定位(摘类清内联, 保底可用性;
     锚位写不进签名门: 签名未变内容零重写, 位置照写) */
  rec.setCam(Object.assign({}, HL_CAM_DEFAULT,
      {yaw: Math.PI, dir: hlAimDir(HL_A.anchor)}));
  rec.ui.sync();
  assert.strictEqual(bubble.hidden, false, '回落档气泡仍显(位置降级非消失)');
  assert.strictEqual(bubble.classList.contains('is-anchored'), false,
      '出视野摘锚定类(CSS 基础款底部固定位兜底)');
  assert.strictEqual(bubble.style.left, '', '清内联位(回落零残留)');
  assert.strictEqual(bubble.style.top, '', '清内联位(回落零残留)');
});

/* ============================================================
   波次三专项一(lead 扩权): bubbleCamRef 接线缝——产线 camRef=null 休眠态
   下 attachBubbleCam 点亮「hover 判定→气泡锚定→点选会话」整链; 标记视觉
   档(refreshHl 投影)仍吃 camRef 保持休眠=授权边界(零视觉溢出)。
   ============================================================ */
test('专项一 bubbleCam 缝: camRef=null 休眠态接线后 hover/锚定/点选活而标记档仍 hidden 零溢出; attach(null) 摘除全链回休眠', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const doc = fakeDoc();
  const rec = {speech: fakeSpeech(), timer: fakeTimer(), pages: [], interact: []};
  rec.ui = townUi.mkTownUi({
    doc,
    machineRef: () => ({snapshot: () => ({focusId: null, states: {}})}),
    speech: rec.speech.speech,
    timer: rec.timer,
    showPage: (id) => rec.pages.push(id),
    hlSource: () => HL_FIXTURES,
    onInteract: (payload) => rec.interact.push(payload),
  }); /* 无 camRef: 产线休眠态同形(mkTownUi({}) 缺省同款) */
  rec.doc = doc;
  rec.fire = (type, evt) => doc.fire(type, evt || {});
  rec.ui.sync(); /* 进镇挂载(标记挂出但无 cam 全隐藏) */
  const mkA = markOf(rec, 'bell-tower');
  assert.strictEqual(mkA.hidden, true,
      '休眠态基线: 标记全隐藏(camRef=null 零伪造投影)');
  rec.fire('mousemove', {});
  assert.strictEqual(rec.interact.length, 0,
      '接线前 hover 死(命中链不可达=波次二披露的产线现状)');
  /* 接线: attachBubbleCam 注入锚定功能档源(hover 判定+锚定投影同源自洽) */
  const BUB_CAM = Object.assign({}, HL_CAM_DEFAULT, {dir: hlAimDir(HL_A.anchor)});
  rec.ui.attachBubbleCam(() => BUB_CAM);
  rec.fire('mousemove', {});
  const bubble = dlgElOf(rec, 'town-dlg-bubble');
  assert.strictEqual(bubble.hidden, false, '接线后 hover 活: 气泡显(判定源点亮)');
  assert.strictEqual(bubble.classList.contains('is-anchored'), true,
      '锚定档激活(投影源同缝, is-anchored+内联位)');
  assert.ok(bubble.style.left !== '' && bubble.style.top !== '',
      '锚定内联位写入(投影跟帧)');
  assert.strictEqual(mkA.hidden, true,
      '标记视觉档仍休眠(refreshHl 仍吃 camRef=null, 授权边界)');
  assert.strictEqual(mkA.classList.contains('is-hover'), true,
      'hover 状态类写进隐藏标记(状态记账活, 视觉零溢出)');
  rec.fire('pointerdown', {});
  rec.fire('pointerup', {});
  assert.strictEqual(rec.interact.length, 1,
      '点选结算随 hover 连带活(T-UI-04 对话可达前提, 报告披露面)');
  assert.strictEqual(rec.interact[0].id, 'bell-tower', '命中对象=锚条目本尊');
  rec.ui.attachBubbleCam(null); /* 摘除→回落 camRef=null→全链回休眠 */
  rec.fire('mousemove', {});
  assert.strictEqual(bubble.hidden, true, '摘除回落: 气泡隐(全链回休眠)');
  assert.strictEqual(rec.interact.length, 1, '摘除后点选死(hoveredEntry 已清, 计数不增)');
});

/* ============================================================
   波次三 TIDEA-18: 反馈音效五槽(沿语义黑盒钉死)——气泡冒出/面板开合/
   选项轻点/表扬浮现各沿一声, 同态重入零重响; 第五槽 bell_town(回望脉冲
   配对)由 TIDEA-16 测试补断言。sfx 桩=mkHlHarness 缺省记录 rec.sfxKinds。
   ============================================================ */
test('TIDEA-18 五槽沿语义: 气泡冒出/面板开合/选项轻点/表扬浮现各沿一声, 同态重入零重响; 面内态转移零新声, 关面板沿+回落探索气泡沿各一声', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const rec = dlgHarness(() => ({snapshot: () => ({focusId: null, states: {}})}));
  rec.ui.sync();
  assert.deepStrictEqual(rec.sfxKinds, [], '静止态零声(挂载即静)');
  rec.clickEntry(DLG_TASK_SEEK);
  assert.deepStrictEqual(rec.sfxKinds, ['bubble_pop', 'dlg_flip'],
      '气泡冒出+面板开各一声(hover 沿先于点选开面沿)');
  rec.fire('mousemove', {});
  rec.ui.sync();
  assert.strictEqual(rec.sfxKinds.length, 2,
      '同态重入(mousemove+采样拍)零重响(沿检测非轮询播)');
  rec.clickEntry(DLG_TASK_SEEK); /* 点中目标→respond(面板内态转移) */
  assert.strictEqual(rec.sfxKinds.length, 2,
      '面板内态转移零新声(开合沿只随 open/idle 翻转)');
  rec.timer.fireAll(); /* confirm 短驻泵→praise */
  assert.strictEqual(rec.sfxKinds.filter((k) => k === 'praise_jingle').length, 1,
      '表扬浮现一声(jingle)');
  rec.ui.sync();
  assert.strictEqual(rec.sfxKinds.filter((k) => k === 'praise_jingle').length, 1,
      '表扬持续态零重响');
  rec.timer.fireAll(); /* dwell 泵→complete */
  const bye = dlgElOf(rec, 'town-dlg-opts').children.find(
      (b) => b.textContent.includes('再见'));
  assert.ok(bye, 'complete 出口[再见]在位(前置)');
  bye.click(); /* chip_pop + close→关面沿 + 回落探索态气泡沿 */
  assert.strictEqual(rec.sfxKinds.filter((k) => k === 'chip_pop').length, 1,
      '选项轻点一声(chip pop)');
  assert.strictEqual(rec.sfxKinds.filter((k) => k === 'dlg_flip').length, 2,
      '面板开合各一沿(共两声)');
  assert.deepStrictEqual(rec.sfxKinds,
      ['bubble_pop', 'dlg_flip', 'praise_jingle', 'chip_pop', 'dlg_flip', 'bubble_pop'],
      '全链音序钉死(五槽各就位, 无多余声)');
});

test('TIDEA-16 回望钟塔回礼: 先离开正前再回正前→L2 徽章 seen-pulse 一次(1.6s 定时摘类); 冷却 30s 内不重烧; 脉冲中离镇→类摘句柄清(零跨轮)', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const prevMap = globalThis.TOWN_MAP;
  globalThis.TOWN_MAP = {anchors: [{id: 'bell-tower', x: 79, y: 40, z: 60}]};
  try {
    /* 出生背对钟塔(yaw π): armed 面前不烧(防出生直视即烧的「回望」语义) */
    const pose = {x: 79, y: 25, z: 96, yaw: Math.PI};
    const machine = {snapshot: () => ({focusId: null, states: {}})};
    const rec = mkHarness(() => machine, () => pose);
    rec.ui.sync(); /* 进镇挂载 */
    const badge = rec.ui.root.children
        .find((c) => c.classList.contains('town-hud-pointer'))
        .children.find((c) => c.classList.contains('town-hud-pointer-badge'));
    assert.ok(badge, 'L2 徽章在册(前置)');
    rec.ui.sync(); /* 位姿采样: 背对→armed=true 零脉冲 */
    assert.strictEqual(badge.classList.contains('seen-pulse'), false,
        '出生直视不烧(未曾离开正前不触发)');
    pose.yaw = 0; /* 回望: 回正前 */
    rec.ui.sync();
    assert.strictEqual(badge.classList.contains('seen-pulse'), true,
        '离开正前→回正前→一次性回礼脉冲');
    assert.deepStrictEqual(rec.sfxKinds, ['bell_town'],
        '回礼钟鸣配对一声(TIDEA-18; bell_town 同枚迎宾钟, 语义统一「镇钟」)');
    assert.strictEqual(rec.timer.pending.length, 1, '脉冲驻留计时在册');
    assert.strictEqual(rec.timer.pending[0].ms, 1600, '驻留 1.6s(呼吸周期同族)');
    rec.timer.fireAll();
    assert.strictEqual(badge.classList.contains('seen-pulse'), false, '驻留毕摘类');
    /* 冷却防刷: 再离开+回望(真实墙钟同毫秒=冷却窗内)→armed 撤但不重烧 */
    pose.yaw = Math.PI;
    rec.ui.sync();
    pose.yaw = 0;
    rec.ui.sync();
    assert.strictEqual(badge.classList.contains('seen-pulse'), false,
        '冷却 30s 内不重烧');
    assert.strictEqual(rec.timer.pending.length, 0, '冷却挡零新计时');
    assert.strictEqual(rec.sfxKinds.length, 1, '冷却挡零新声(不重烧即不重响)');
    /* 离镇卫生(新机=新会话态, 墙钟冷却不跨实例): 脉冲中离镇→类摘+句柄清 */
    const pose2 = {x: 79, y: 25, z: 96, yaw: Math.PI};
    let live = true;
    const rec2 = mkHarness(() => (live ? machine : null), () => pose2);
    rec2.ui.sync(); /* 进镇(enterTown 清 armed; 进场帧不跑查检) */
    rec2.ui.sync(); /* 采样: 背对→armed=true(「回望」语义: 先离开正前) */
    pose2.yaw = 0;
    rec2.ui.sync(); /* 回望→脉冲(towerSeenLast 初值 0, 冷却恒过) */
    const badge2 = rec2.ui.root.children
        .find((c) => c.classList.contains('town-hud-pointer'))
        .children.find((c) => c.classList.contains('town-hud-pointer-badge'));
    assert.strictEqual(badge2.classList.contains('seen-pulse'), true,
        '前置: 实例二脉冲在位');
    assert.deepStrictEqual(rec2.sfxKinds, ['bell_town'],
        '实例二回礼钟鸣一声(新机新账, 音随脉冲走)');
    live = false;
    rec2.ui.sync(); /* 离镇弃机 */
    assert.strictEqual(rec2.timer.pending.length, 0, '脉冲句柄随离镇清');
    assert.strictEqual(rec2.ui.root.hidden, true, '容器收敛(离镇语义不变)');
  } finally {
    if (prevMap === undefined) delete globalThis.TOWN_MAP;
    else globalThis.TOWN_MAP = prevMap;
  }
});

/* TIDEA-19 首访轻引导测试随左上状态卡移除撤除(PO 返工 2026-11-15:
   首访拦截文案=卡三态之一, 卡壳+文案+记账(enteredOnce/greetDone/hintOn)
   全清; greet done 事件 feed 链保留=机制 headless, 其行为由上方会话避让
   与 seek 全链测试承担) */

/* ============================================================
   T-NPC-11 对账补缺红测(§1.7 禁止项硬清单 + 票面会师 4 已裁口径;
   票面施工记录 §7.3): 对账结论=禁止项四项中「无键盘依赖」与
   「事件名唯一权威」两域零守门, 立红补缺。守门测试红相自证=
   突变注入违例见红/还原见绿(票面施工记录 §7.3 自证列)。
   ============================================================ */

test('禁止项守门(§6.3): 对话链源文本零键盘绑定——keydown/keyup/keypress/KeyboardEvent 全域缺席, 点击为唯一必要操作', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const kb = /addEventListener\(\s*['"]key(?:down|up|press)['"]|onkey(?:down|up|press)|KeyboardEvent/;
  for (const f of ['js/town-ui.js', 'js/town-dialog-core.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!kb.test(src), f + ' 出现键盘事件绑定(§6.3: 无键盘快捷键依赖, ' +
        '纯鼠标点选为唯一必要操作)');
  }
});

test('事件名权威守门(票面会师 4 已裁): 双 js 源+index.html(只读)零旧名 town:dialog*, town-ui/dialog/* 唯一权威', () => {
  assert.ok(townUi, 'js/town-ui.js 缺席(红期)');
  const legacy = /town:dialog/;
  for (const f of ['js/town-ui.js', 'js/town-dialog-core.js', 'index.html']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!legacy.test(src), f + ' 出现旧事件名 town:dialog*(双名歧义已裁: ' +
        '唯一权威=town-ui/dialog/*, 旧名不实现)');
  }
});


