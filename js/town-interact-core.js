'use strict';
/* ============================================================
   城镇交互核心 (TownInteractCore) — 应用层·纯核心
   ------------------------------------------------------------
   一句话职责: 城镇场景内交互锚点与轻任务状态钩子的数据与事件协议层——
   冻结协议常量+注册清单+注册派生/目标形状纯函数+目标状态机; HUD/指针/
   对话框只消费本层的事件与数据形状(渲染与 UI 组件归 T-UI 线, 不越界)。
   interface: TOWN_UI_EVENTS(冻结事件名表: targetFocus/targetUpdate/
      interactFocus/interactBlur) · TOWN_INTERACT_KINDS(冻结交互四类
      landmark|npc|prop|task) · TOWN_SESSION_KINDS(冻结会话五值
      greet|tour|seek|help|care) · TOWN_INTERACTS(M8 默认注册清单二十条:
      六锚点条目 id 恒等 TOWN_MAP.anchors 锚 id + 三轻任务 task: 前缀 +
      11 条 npc 条目(T-NPC-10 追加在册尾, V01~V10+G01, label/sessionKind
      =注册表 TOWN_NPCS 定值, 动物零条目)) ·
      townInteractRegistry(list?) 纯函数(校验+快照: 坐标单源锚点/taskRef
      恒=id/拼写域抛错, 同参同输出零副作用) · townTargetOf(entry, snap)
      纯函数(消费最小面恰六键) · mkTownTargets({emit}) → {focus, found,
      reset, snapshot}(事件经返回值 events+emit 双面暴露, 状态域只有
      active|done, 零墙钟)
   依赖: 零运行时依赖——不引用引擎件/件库符号; TOWN_MAP 仅调用期解析
      (js/town-map-core.js 在前; index.html 加载序 map-core → assembly-core
      → 本文件 → modes/town.js → main.js)。规格源 docs/town-map-design.md
      §4/§6.2/§8#8 与 docs/design/town-ui-hud-prebuild.md §2.6。
   可测性声明: 零三维渲染库 · 零 DOM · 零墙钟 · 零随机 · 有同名单测
      (test/town-interact-core.test.js)。
   ============================================================ */

/* ---------- 协议常量(全冻结防漂移): 事件名表恰四键 · 交互对象四类 ·
    会话五值(dialog-prebuild §2.4 枚举收编, 本仓无事件总线, 事件经
    返回值+emit 注入双面暴露) ---------- */
const TOWN_UI_EVENTS = Object.freeze({
  targetFocus: 'town-ui/target/focus',
  targetUpdate: 'town-ui/target/update',
  interactFocus: 'town-ui/interact/focus',
  interactBlur: 'town-ui/interact/blur',
});

const TOWN_INTERACT_KINDS = Object.freeze(['landmark', 'npc', 'prop', 'task']);
const TOWN_SESSION_KINDS = Object.freeze(['greet', 'tour', 'seek', 'help', 'care']);

/* ---------- 交互锚点注册清单(M8 默认, map-design §8#8: 广场导览+2-3 个
    观察-寻找-回应轻任务; T-NPC-10 起 +11 条 npc 条目追加在册尾): 六锚点
    条目 id 恒等锚 id(目标 id 继承 TOWN_MAP.anchors 空间, 零第二命名规
    则), 三轻任务 id 用 task: 前缀(任务与目标同一 id 空间), npc 条目
    id='npc:'+npcId 小写(镜像 task: 先例); 坐标不在此拍板——registry
    派生时单源取自 TOWN_MAP.anchors; spawn 出生锚非交互点不在册。
    npc 条目 label/sessionKind=注册表(js/town-npc-registry.js TOWN_NPCS)
    定值——「派生不复制」由三表对账测试(npcId/anchorId/label 三向一致)
    锁一致, 真值由 town-npc-registry.test.js 字面表另锁; 动物(A01~A03
    纯氛围)零条目不进协议。 ---------- */
const TOWN_INTERACTS = [
  {id: 'bell-tower', anchorId: 'bell-tower', kind: 'landmark', iconKey: 'belltower',
    label: '钟塔'},
  {id: 'lava-chicken', anchorId: 'lava-chicken', kind: 'landmark', iconKey: 'lavachicken',
    label: '炸鸡店'},
  {id: 'windmill', anchorId: 'windmill', kind: 'landmark', iconKey: 'windmill', label: '风车'},
  {id: 'farm', anchorId: 'farm', kind: 'landmark', iconKey: 'farm', label: '小农田'},
  {id: 'market', anchorId: 'market', kind: 'prop', iconKey: 'plaza', label: '市集摊位'},
  {id: 'stash', anchorId: 'stash', kind: 'prop', iconKey: 'stash', label: '秘密小屋'},
  {id: 'task:tour-plaza', anchorId: 'bell-tower', kind: 'task', iconKey: 'plaza',
    label: '逛逛广场', sessionKind: 'tour'},
  {id: 'task:find-bread', anchorId: 'market', kind: 'task', iconKey: 'find',
    label: '找面包', sessionKind: 'seek'},
  {id: 'task:visit-stash', anchorId: 'stash', kind: 'task', iconKey: 'stash',
    label: '探秘小屋', sessionKind: 'seek'},
  /* ---- T-NPC-10 条目入册: 11 条 npc 条目追加在册尾(V01~V10+G01, 票面
      §3 冻结六键形状 {id, anchorId, kind, iconKey, label, sessionKind}
      不多不少; iconKey 按 2026-11-15 定稿(receipts/iconkey-decision.md
      §三): 村民统一 'help'=💬 语义 affordance, G01 'care'=💗 关怀语义) ---- */
  {id: 'npc:v01', anchorId: 'npc:v01', kind: 'npc', iconKey: 'help',
    label: '阿面', sessionKind: 'greet'},
  {id: 'npc:v02', anchorId: 'npc:v02', kind: 'npc', iconKey: 'help',
    label: '麦芽', sessionKind: 'help'},
  {id: 'npc:v03', anchorId: 'npc:v03', kind: 'npc', iconKey: 'help',
    label: '石匠阿砌', sessionKind: 'help'},
  {id: 'npc:v04', anchorId: 'npc:v04', kind: 'npc', iconKey: 'help',
    label: '图图', sessionKind: 'tour'},
  {id: 'npc:v05', anchorId: 'npc:v05', kind: 'npc', iconKey: 'help',
    label: '铁匠炉火', sessionKind: 'help'},
  {id: 'npc:v06', anchorId: 'npc:v06', kind: 'npc', iconKey: 'help',
    label: '朵朵', sessionKind: 'seek'},
  {id: 'npc:v07', anchorId: 'npc:v07', kind: 'npc', iconKey: 'help',
    label: '小厨乐乐', sessionKind: 'greet'},
  {id: 'npc:v08', anchorId: 'npc:v08', kind: 'npc', iconKey: 'help',
    label: '钟叔', sessionKind: 'greet'},
  {id: 'npc:v09', anchorId: 'npc:v09', kind: 'npc', iconKey: 'help',
    label: '牧童豆豆', sessionKind: 'help'},
  {id: 'npc:v10', anchorId: 'npc:v10', kind: 'npc', iconKey: 'help',
    label: '跑跑妮妮', sessionKind: 'greet'},
  {id: 'npc:g01', anchorId: 'npc:g01', kind: 'npc', iconKey: 'care',
    label: '铁守护·阿稳', sessionKind: 'care'},
];

/* ---------- 注册派生: 校验+快照(纯函数) ----------
   校验即拼写域错误(违规值进消息): id 唯一 · kind 在域 · task 条目 id 必
   task: 前缀且 sessionKind 在域 · npc 条目必带 sessionKind · 非 task 条目
   不带 taskRef · anchorId 必在 TOWN_MAP.anchors 在册。快照每条 = 源字段
   透传 + anchor 坐标单源取锚 + task 补 taskRef(恒=id) + state 初始
   active; 保源序, 不改源清单与布局权威(同参同输出零副作用)。 */
function townInteractRegistry(list = TOWN_INTERACTS) {
  const anchorById = {};
  for (const a of TOWN_MAP.anchors) anchorById[a.id] = a;
  const seen = new Set();
  const out = [];
  for (const e of list) {
    if (seen.has(e.id)) {
      throw new Error('townInteractRegistry: 条目 id 重复「' + e.id + '」(目标 id 空间唯一)');
    }
    seen.add(e.id);
    if (!TOWN_INTERACT_KINDS.includes(e.kind)) {
      throw new Error('townInteractRegistry: 条目「' + e.id + '」kind 越域「' + e.kind +
        '」(合法域 landmark|npc|prop|task)');
    }
    if (e.kind === 'task' && !e.id.startsWith('task:')) {
      throw new Error('townInteractRegistry: task 条目「' + e.id +
        '」id 须 task: 前缀(任务与目标同一 id 空间)');
    }
    if ((e.kind === 'task' || e.kind === 'npc') &&
        !TOWN_SESSION_KINDS.includes(e.sessionKind)) {
      throw new Error('townInteractRegistry: 条目「' + e.id + '」sessionKind 越域「' +
        e.sessionKind + '」(合法域 greet|tour|seek|help|care)');
    }
    if (e.kind !== 'task' && 'taskRef' in e) {
      throw new Error('townInteractRegistry: 非 task 条目「' + e.id +
        '」不带 taskRef(taskRef 只属任务, 派生面单源)');
    }
    const a = anchorById[e.anchorId];
    if (!a) {
      throw new Error('townInteractRegistry: 条目「' + e.id + '」anchorId「' + e.anchorId +
        '」不在 TOWN_MAP.anchors(布局契约破坏, 锚点在册性)');
    }
    const snap = {id: e.id, kind: e.kind, iconKey: e.iconKey, label: e.label,
      anchor: {x: a.x, y: a.y, z: a.z}, state: 'active'};
    if (e.kind === 'task') snap.taskRef = e.id;
    if (e.sessionKind !== undefined) snap.sessionKind = e.sessionKind;
    out.push(snap);
  }
  return out;
}

/* ---------- 目标形状: A 侧消费最小面(hud-prebuild §2.6 townTarget 定稿) ----------
   恰六键不多不少(多余字段即协议泄漏); state 取快照当前值(初始 active 由
   registry 保证, done 由状态机写入, 形状函数只读不自产状态)。 */
function townTargetOf(entry, snap) {
  return {
    id: entry.id,
    kind: entry.kind,
    iconKey: entry.iconKey,
    label: entry.label,
    anchor: snap.anchor,
    state: snap.state,
  };
}

/* ---------- 目标状态机: focus/found/reset 三迁移+snapshot 查询面 ----------
   状态域只有 active|done 两值(零惩罚: 可重复达成可重来, 无压迫语义);
   迁移事件经返回值 events+emit 注入双面暴露(emit 两参旁路注入, 缺省
   空实现由调用方给); 签名不含 now/tick(零墙钟, 装配层才管节奏);
   机器只读注册快照, 源清单与布局权威永不被写。 */
function mkTownTargets(opts) {
  const emit = opts.emit;
  const reg = townInteractRegistry(); /* 坏清单构造即抛(注册校验共用此缝) */
  const byId = {};
  for (const r of reg) byId[r.id] = r;
  const states = {};
  for (const r of reg) states[r.id] = 'active';
  let focusId = null;
  /* 发一条事件: 同步旁路 emit + 入返回值 events(同一 payload 对象) */
  const fire = (name, payload) => {
    emit(name, payload);
    return {name, payload};
  };
  return {
    /* 切换主目标: id 须在注册集(未知抛拼写域错); null 是显式清空;
       重复同值幂等(active 态不重复打扰); 已 done 目标重复 focus 再发
       一条(完成态回看, 携 done 态); 迁移时恰一条 target/focus(payload.
       target=完整 townTarget 或 null, state 携当前值)。 */
    focus(id) {
      if (id !== null && !byId[id]) {
        throw new Error('mkTownTargets.focus: 未知目标「' + id + '」(须在注册集内)');
      }
      if (id === focusId && states[id] !== 'done') return {changed: false, events: []};
      focusId = id;
      const target = id === null ?
        null :
        townTargetOf(byId[id], {anchor: byId[id].anchor, state: states[id]});
      return {changed: true, events: [fire(TOWN_UI_EVENTS.targetFocus, {target})]};
    },
    /* 目标达成: active→done 单向迁移(不回退), 恰一条 target/update
       {id, state}; 已 done 幂等零事件(不重复表扬); 未知 id 抛错。 */
    found(id) {
      if (!byId[id]) {
        throw new Error('mkTownTargets.found: 未知目标「' + id + '」(须在注册集内)');
      }
      if (states[id] === 'done') return {changed: false, events: []};
      states[id] = 'done';
      return {changed: true,
        events: [fire(TOWN_UI_EVENTS.targetUpdate, {id, state: 'done'})]};
    },
    /* 全量重来: 回 active、清主目标, 零事件(重放 focus 是装配层显式动作)。 */
    reset() {
      for (const r of reg) states[r.id] = 'active';
      focusId = null;
      return {changed: true, events: []};
    },
    /* 查询面: 返回拷贝(外部改写不反渗机器)。 */
    snapshot() {
      const copy = {};
      for (const r of reg) copy[r.id] = states[r.id];
      return {focusId, states: copy};
    },
  };
}
