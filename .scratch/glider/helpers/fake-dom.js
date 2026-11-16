'use strict';
/* ==== FakeDomKit — 测试装具（Node 假 DOM 元素工厂，全仓唯一来源）
   一句话职责: 产出只暴露标准 DOM 面的假元素——测试装具一律 require 本工厂取假元素，
   测试文件禁止自定义元素工厂（守门: test/conventions.test.js「假 DOM 单一来源」断言，
   规范正文 docs/conventions.md §7.2）。
   缘起: T-UI-03/04 两度复发——假 DOM 暴露非标准面（attrs / 裸数组 children），
   生产照装具形状写而非照真实契约写（markElOf 读 .attrs、clearChildren 用 children.pop，
   真机即炸）。面收敛一处改处处改，根治「第四站点」式漏网。
   interface: mkEl(tag?) → 假元素 · liveKids(kids) → live 只读集合视图
   依赖(均经全局名, 调用期解析): 零依赖（Node 内建 Proxy，CommonJS 直 require）
   可测性声明: 零 THREE·零 DOM·smoke 断言在 test/conventions.test.js ====

   面清单（与真实 Element 契约对齐；缺面按 MDN 补，不发明私有小平面）:
   - tag/id/title/hidden/textContent/style/dataset/onclick 普通可写属性;
   - className get/set ↔ classList 同步（真 DOM 语义）;
   - classList add/remove/toggle/contains + __classOps 计数（测试观测面，按调用次计）;
   - 属性闭包私有，公开面只走 get/setAttribute（F1 契约，真实 Element 无 .attrs）;
   - children 为 live 只读集合视图（无 push/pop 等变更法，S-1 契约，同 HTMLCollection）;
   - 子件增删唯一通道 appendChild/removeChild（removeChild 非子件即抛 NotFoundError）;
   - parentNode + parent 双名: parent 是 town-ui 生产 headless 契约的历史名
     （js/town-ui.js mkHeadlessDoc 同形），parentNode 是标准名——工厂同步维护两名;
   - addEventListener 记录到 _ev（last-wins，测试手动派发用）· click() 触发 onclick ·
     remove() 从父件摘除 · querySelector 每选择器懒缓存同实例 ·
     innerHTML get/set（赋值即清空子件，真 DOM 覆盖语义）。 */

function liveKids(kids) {
  const methods = {
    item: (i) => kids[i],
    find: (fn) => kids.find(fn),
    filter: (fn) => kids.filter(fn),
    map: (fn) => kids.map(fn),
    forEach: (fn) => kids.forEach(fn),
    slice: (...a) => kids.slice(...a),
    indexOf: (x) => kids.indexOf(x),
    includes: (x) => kids.includes(x),
  };
  /* 变更法缺席(push/pop/splice/...) = S-1 契约: 子件增删唯一通道是
     appendChild/removeChild(真 HTMLCollection 无变更法); 其余只读方法
     通用透传(every/some/flatMap/reduce/at/... 不再逐个补列) */
  const MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort',
    'reverse', 'fill', 'copyWithin', 'set', 'setLength']);
  return new Proxy(methods, {
    get(t, k) {
      if (k === 'length') return kids.length;
      if (typeof k === 'string' && /^[0-9]+$/.test(k)) return kids[+k];
      if (k === Symbol.iterator) return () => kids[Symbol.iterator]();
      if (!MUTATORS.has(k) && typeof Array.prototype[k] === 'function') {
        return (...a) => Array.prototype[k].apply(kids, a);
      }
      return t[k];
    },
  });
}

function mkEl(tag) {
  const classes = new Set();
  const attrs = {}; /* 闭包私有(F1): 公开面只走 get/setAttribute = 真实 DOM 面 */
  const kids = []; /* 闭包私有(S-1): children 只暴露 live 只读视图 */
  const evs = {}; /* 监听记录(测试观测面): type → fn, last-wins(mode-kit 先例) */
  const classOps = {add: 0, remove: 0}; /* 按调用次计数(T-UI-03 签名门控观测面) */
  const view = liveKids(kids);
  const qCache = new Map();
  let html = '';
  const el = {
    tag, id: '', title: '', parent: null, parentNode: null,
    hidden: false, textContent: '', style: {}, dataset: {}, onclick: null,
    _ev: evs,
    __classOps: classOps,
    get children() {
      return view;
    },
    get className() {
      return [...classes].join(' ');
    },
    set className(v) {
      classes.clear();
      String(v).split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
    },
    classList: {
      add(...cs) {
        classOps.add += 1;
        for (const c of cs) classes.add(c);
      },
      remove(...cs) {
        classOps.remove += 1;
        for (const c of cs) classes.delete(c);
      },
      toggle(c, v) {
        const on = (v === undefined) ? !classes.has(c) : v;
        if (on) classes.add(c); else classes.delete(c);
      },
      contains(c) {
        return classes.has(c);
      },
    },
    setAttribute(k, v) {
      attrs[k] = String(v);
    },
    getAttribute(k) {
      return attrs[k];
    },
    addEventListener(type, fn) {
      evs[type] = fn;
    },
    removeEventListener(type) {
      delete evs[type];
    },
    appendChild(c) {
      /* 换父先摘(真 DOM appendChild 是移动语义): 防旧父 kids 留幽灵子件 */
      if (c.parentNode) c.parentNode.removeChild(c);
      kids.push(c);
      c.parentNode = el;
      c.parent = el;
      return c;
    },
    removeChild(c) {
      const i = kids.indexOf(c);
      if (i < 0) throw new Error('NotFoundError: removeChild 的实参不是子件');
      kids.splice(i, 1);
      c.parentNode = null;
      c.parent = null;
      return c;
    },
    click() {
      if (el.onclick) el.onclick({});
    },
    remove() {
      if (el.parentNode) el.parentNode.removeChild(el);
    },
    querySelector(sel) {
      if (!qCache.has(sel)) qCache.set(sel, mkEl());
      return qCache.get(sel);
    },
    get innerHTML() {
      return html;
    },
    set innerHTML(v) {
      html = String(v);
      /* 真 DOM 覆盖语义: 旧子件随重写被摘除——摘链要清干净(innerHTML
         清 kids 不清 parentNode 曾让 unmount 的守卫 removeChild 炸陈旧引用) */
      for (const k of kids) {
        k.parentNode = null;
        k.parent = null;
      }
      kids.length = 0;
    },
  };
  return el;
}

module.exports = {mkEl, liveKids};
