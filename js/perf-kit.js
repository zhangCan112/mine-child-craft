'use strict';
/* ============================================================
   性能观测件 (PerfKit, 术语见 GLOSSARY.md"画质核心") — 应用层调试工具
   ------------------------------------------------------------
   ?perf=1 才常驻的页内性能 HUD: iOS Safari 无 performance.memory、Windows
   开发机无法远程调试 Safari(docs/ipad5-performance-research.md §2.6) — 这是
   iPad 5 档调优的唯一现实验收面。1Hz 刷一行只读遥测: fps/DPR/renderer.info/
   LPM 态/上下文丢失计数/疑似内存击杀重载计数/逻辑核数/GL 纹理上限。
   interface: enabled(只读旗标) · init(自检+心跳, main.js init 调一次) ·
     tick(now)(主循环每帧喂, 内部 1Hz 节流刷 HUD; 未启用零成本早退)。
   依赖(均经全局名, 调用期解析): config.js(IS_LOWCORE_TOUCH) ·
     world.js(renderer) · main.js(fps/lpmOn/glLostCount — 顶层绑定)。
   DOM/定时器惰性创建, 未启用零副作用 — Node 测试环境可安全加载(boot 冒烟)。
   ============================================================ */

const PerfKit = {
  /* ?perf=1 总开关(?touch=1/?dev=1 同款防御式读取, config.js 惯例) */
  enabled: (() => {
    try {
      return (location.search || '').includes('perf=1');
    } catch (e) {
      return false;
    }
  })(),
  hud: null,
  lastPaint: 0,
  reloads: 0, /* 疑似内存击杀(jetsam)重载计数: 上一会话心跳新鲜且无干净退出旗标 */
  maxTex: 0,
  maxRb: 0,

  /* init(): HUD 建点 + 一次性 GL 自查(调研 §6 待实测项本机落地) + 心跳/击杀代理 */
  init() {
    if (!this.enabled || typeof document === 'undefined') return;
    try {
      const gl = renderer.getContext();
      this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      this.maxRb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    } catch (e) {/* 渲染器缺席则留 0, HUD 显示占位 */}
    /* 心跳+击杀代理(调研 §2.6-6): 3s 一跳写 sessionStorage; 启动时上一跳 <15s
       新鲜 且 无干净退出旗标(pagehide 已设) → 上一会话被整页静默重载 = jetsam/
       崩溃特征, 计数+1 并累计在会话存储。计数是内存压力的代理指标, 非精确值。 */
    try {
      const ss = sessionStorage;
      const beat = +(ss.getItem('perfBeat') || 0);
      this.reloads = +(ss.getItem('perfKills') || 0);
      if (beat && Date.now() - beat < 15000 && !ss.getItem('perfClean')) {
        this.reloads++;
        ss.setItem('perfKills', String(this.reloads));
      }
      ss.removeItem('perfClean');
      setInterval(() => ss.setItem('perfBeat', String(Date.now())), 3000);
      addEventListener('pagehide', () => ss.setItem('perfClean', '1'));
    } catch (e) {/* 隐私模式/禁存储: 计数缺席, 其余照常 */}
    const d = document.createElement('div');
    d.id = 'perfHud';
    d.style.cssText = 'position:fixed;bottom:0;left:0;z-index:9997;background:rgba(0,0,0,.65);' +
        'color:#7fff9a;font:11px/1.5 monospace;padding:3px 8px;pointer-events:none;white-space:pre';
    document.body.appendChild(d);
    this.hud = d;
  },

  /* tick(now): 主循环每帧喂; 1Hz 节流刷一行只读遥测 */
  tick(now) {
    if (!this.hud) return;
    if (now - this.lastPaint < 1000) return;
    this.lastPaint = now;
    const info = renderer.info;
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || '?';
    this.hud.textContent =
        'fps ' + fps + ' · dpr ' + renderer.getPixelRatio() +
        (IS_LOWCORE_TOUCH ? '(低核档)' : '') +
        ' · calls ' + info.render.calls +
        ' · tris ' + Math.round(info.render.triangles / 1000) + 'k' +
        ' · geo ' + info.memory.geometries + ' · tex ' + info.memory.textures +
        ' · LPM ' + (lpmOn ? 'ON' : '-') +
        ' · ctxLost ' + glLostCount +
        ' · kills ' + this.reloads +
        ' · cores ' + cores +
        ' · maxTex ' + this.maxTex + '/' + this.maxRb;
  },
};
