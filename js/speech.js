'use strict';
/* ============================================================
   SpeechKit — 全游戏共用的中文语音小 interface
   依赖注入: synthesis(生产=浏览器 speechSynthesis, 测试=fake) + utterance 工厂
   + 可选 hooks(说话起止, A6 接 AudioMixer.duck 给 BGM 让路)
   voice 挑选 / onvoiceschanged 重挑 / cancel-then-speak / 语速音高
   全部收在 implementation; 历史名 focusSpeak 已随拆分退役
============================================================ */
function mkSpeech(synthesis, mkUtterance, hooks) {
  mkUtterance = mkUtterance || ((text) => new SpeechSynthesisUtterance(text));
  /* 说话起止钩子(A6): 缺省空操作 — 既有两参调用方与测试零破坏 */
  const onStart = hooks && typeof hooks.onStart === 'function' ? hooks.onStart : null;
  const onEnd = hooks && typeof hooks.onEnd === 'function' ? hooks.onEnd : null;
  let voice = null;
  let cur = null; // 最近交给 synthesis 的 utterance: onstart/onend 溯源防串句
  let live = false; // cur 已发"说话起"、未发"说话止"(被打断时的兜底窗)
  function fireStart() {
    if (onStart) {
      try {
        onStart();
      } catch (e) {}
    }
  }
  function fireEnd() {
    if (onEnd) {
      try {
        onEnd();
      } catch (e) {}
    }
  }
  function pick() {
    try {
      const vs = synthesis.getVoices();
      voice = vs.find((v)=>/zh[-_]CN/i.test(v.lang)) || vs.find((v)=>/^zh/i.test(v.lang)) || null;
    } catch (e) {}
  }
  if (synthesis) {
    pick(); // 浏览器侧加载即挑一次
    try {
      synthesis.onvoiceschanged = pick;
    } catch (e) {}
  }
  return {
    speak(text) {
      try {
        if (!synthesis) return;
        const u = mkUtterance(text);
        u.lang = 'zh-CN'; u.rate = 0.9; u.pitch = 1.1;
        if (voice) u.voice = voice;
        /* 钩子只认溯源到 u 的事件: 后句顶掉前句后, 浏览器迟到补发的
           前句 onstart/onend 不得误伤新句的让路状态 */
        u.onstart = () => {
          if (cur === u && !live) {
            live = true; fireStart();
          }
        };
        u.onend = () => {
          if (cur === u && live) {
            live = false; fireEnd();
          }
        };
        cur = u;
        /* cancel-then-speak: cancel 不保证派发前句 onend(说话被打断时
           音乐不能压着不回升), 先自行兜底"说话止"; 浏览器若补发前句
           onend, 会被上面的溯源挡掉, 不会双发 */
        if (live) {
          live = false; fireEnd();
        }
        synthesis.cancel(); // 新句子打断旧句子
        synthesis.speak(u);
      } catch (e) {}
    },
    cancel() {
      try {
        if (synthesis) synthesis.cancel();
      } catch (e) {}
      if (live) {
        live = false; fireEnd();
      } // cancel 路径同样要有 end 兜底
    },
  };
}
const SpeechKit = mkSpeech(
    typeof speechSynthesis !== 'undefined' ? speechSynthesis : null,
    undefined,
    /* A6 接线取舍: 在创建处直接接引擎层 AudioMixer(应用层→引擎层方向合法;
       audio.js 先于本文件加载, 钩子只在真实说话时触发, 必已就绪) — 不为
       此暴露注册器、不改 main.js, 也避开与 A5 在 main.js 的合并撞窗 */
    {onStart: () => AudioMixer.duck(true), onEnd: () => AudioMixer.duck(false)});
if (typeof module !== 'undefined' && module.exports) module.exports = mkSpeech;
