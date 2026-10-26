'use strict';
/* ============================================================
   世界改动日志 (WorldJournal) — 应用层纯核心
   ------------------------------------------------------------
   体素世界「玩家改动账本」的存档深接口: edits 差异账记账、脏标、5s 节流
   落盘、关页兜底、双通道重放({id,lv} 流体格→方块+水位两笔, 裸值→方块
   一笔)五件事收进一个工厂; 档形政策(槽位 encode/decode、payload 附加字
   段、联写、超限守卫)全部经 opts 注入, 消费方(探险/建造)只剩缝上的适配
   器, 两模式的重放与编码判据从此互锁。
   interface: mkWorldJournal(slot, opts) → {edits · load · mark · touch ·
     replay · flush · dirty · tick · pageHide}
     fluidCell(id, lv, blocks) — 流体格编码判据唯一权威(两模式账本缝共用)
   依赖(均经全局名, 调用期解析): 无 — 槽/世界写入口/时钟全参数注入; 生产
     接线在 js/modes/adventure.js 与 js/modes/build.js(index.html 加载序
     在本文件之后)
   可测性: 零 THREE · 零 DOM · 零全局可变依赖(时钟缺省 performance.now,
     可注入), 有同名单测 test/world-journal-core.test.js(含两模式形状的
     重放互锁与旧档字面量兼容)
   ============================================================ */

/* 流体格编码(liquid D8): 流体方块(水/岩浆, BLOCKS fluid 旗标)记 {id, lv}
   (lv 0=源), 其余方块记裸数字 id — 旧档零迁移; 判据单份在这里, 模式层
   不得誊写第二份(test/world-journal-core.test.js 源文本守门) */
function fluidCell(id, lv, blocks) {
  return (blocks && blocks[id] && blocks[id].fluid) ? {id, lv: lv || 0} : id;
}

function mkWorldJournal(slot, opts) {
  const o = opts || {};
  const now = o.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  let dirty = false;
  let lastSave = 0; /* 上次节流落盘时刻(墙钟): 0 起 = 会话首笔脏改动到点即存 */
  const J = {
    /* 当前账本 Map "x,y,z"→id|{id,lv}(只存差异, 逐格最后写赢); 建造按场景
       分桶、换场景整只换装——桶形状是消费方政策, journal 只认当前这只 */
    edits: (o.edits instanceof Map) ? o.edits : new Map(),
    /* 读档: 槽位 load/decode 原样透传; Map/数组形状的 edits 顺带收养并归一
       化成 Map(空档 defaults 深拷贝不经 decode, edits 是数组; null 兜底空
       账本); 桶形状(建造)不收养, 由消费方自装当前桶 */
    load() {
      const st = slot.load();
      if (st && st.edits instanceof Map) J.edits = st.edits;
      else if (st && Array.isArray(st.edits)) J.edits = new Map(st.edits);
      else if (st && st.edits == null) J.edits = new Map();
      return st;
    },
    /* 记一笔改动: 账本最后写赢 + 置脏(消费方私事——探险站点缓存/挖炉退包
       ——在调用方 mark 顺路做, 不进 journal) */
    mark(key, val) {
      J.edits.set(key, val);
      dirty = true;
    },
    /* 只置脏不记账: 不动方块但随世界档走的账(任务计数/工具耐久/死畜索引/
       建造当前场景 id) */
    touch() {
      dirty = true;
    },
    /* 双通道重放(确定序 = 账本插入序): 流体格 {id,lv}→方块+水位两笔(不走
       排程), 裸值→方块一笔; set 经注入防全局依赖 */
    replay(set) {
      for (const [k, v] of J.edits) {
        const p = k.split(',');
        if (v && typeof v === 'object') {
          set.block(+p[0], +p[1], +p[2], v.id);
          set.fluid(+p[0], +p[1], +p[2], v.lv || 0);
        } else {
          set.block(+p[0], +p[1], +p[2], v);
        }
      }
    },
    /* 立即落盘(死亡/回家/睡醒/退出即时存与节流/兜底共用, 不看脏标): payload
       钩子缺省 {edits: 账本}; 超限守卫拦下则不落盘不清脏(下个节流窗重试);
       伴随联写(onFlush)在主档之后——探险三档联写次序 */
    flush() {
      const payload = o.payload ? o.payload(J.edits) : {edits: J.edits};
      if (o.overSize && o.overSize(payload)) return false;
      slot.save(payload);
      if (o.onFlush) o.onFlush();
      dirty = false;
      return true;
    },
    /* 只读脏标(关页兜底/节流泵的判定面) */
    dirty() {
      return dirty;
    },
    /* 节流泵(update 每帧): 脏且距上次落盘超 ms(缺省 5000)则 flush — 墙钟
       口径与既有两模式实现逐字一致(不累计 dt, 后台挂钟时间照算) */
    tick(ms) {
      const win = (ms == null) ? 5000 : ms;
      if (dirty && now() - lastSave > win) {
        lastSave = now();
        J.flush();
        return true;
      }
      return false;
    },
    /* 关页兜底(main.js pagehide 收口): 脏则同步落盘(localStorage 同步写,
       pagehide 内安全; 服务器 push 由 main.js 统一补发) */
    pageHide() {
      if (dirty) J.flush();
    },
  };
  return J;
}

const WorldJournal = {mkWorldJournal, fluidCell};
if (typeof module !== 'undefined' && module.exports) module.exports = WorldJournal;
