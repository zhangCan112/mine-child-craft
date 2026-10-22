'use strict';
/* ============================================================
   SpeechKit — 全游戏共用的中文语音小 interface
   依赖注入: synthesis(生产=浏览器 speechSynthesis, 测试=fake) + utterance 工厂
   voice 挑选 / onvoiceschanged 重挑 / cancel-then-speak / 语速音高
   全部收在 implementation; 历史名 focusSpeak 已随拆分退役
============================================================ */
function mkSpeech(synthesis, mkUtterance) {
  mkUtterance = mkUtterance || ((text) => new SpeechSynthesisUtterance(text));
  let voice = null;
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
        synthesis.cancel(); // 新句子打断旧句子
        synthesis.speak(u);
      } catch (e) {}
    },
    cancel() {
      try {
        if (synthesis) synthesis.cancel();
      } catch (e) {}
    },
  };
}
const SpeechKit = mkSpeech(
  typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
if (typeof module !== 'undefined' && module.exports) module.exports = mkSpeech;
