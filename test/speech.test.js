'use strict';
/* SpeechKit (js/speech.js) 单测 — node --test (零依赖)
   require 直载: Node 下无 speechSynthesis → 浏览器侧实例为 null-synthesis,
   加载零副作用; 合成器与 utterance 工厂均经参数注入(fake) */
const test = require('node:test');
const assert = require('node:assert');
const mkSpeech = require('../js/speech.js');

const mkU = (text) => ({text, lang: null, rate: null, pitch: null, voice: null});
function mkSyn(log, voices) {
  return {
    getVoices() {
      return voices || [{lang: 'en-US'}, {lang: 'zh-TW'}, {lang: 'zh-CN'}, {lang: 'ja-JP'}];
    },
    cancel() {
      log.push('cancel');
    },
    speak(u) {
      log.push(['speak', u]);
    },
  };
}

test('voice 挑选: zh-CN 优先, 无 zh-CN 退任意 zh, 全无则不带 voice', () => {
  function picked(voices) {
    const log = [];
    mkSpeech(mkSyn(log, voices), mkU).speak('x');
    return log[1][1].voice; // log: ['cancel', ['speak', u]]
  }
  assert.strictEqual(picked([{lang: 'en-US'}, {lang: 'zh-TW'}, {lang: 'zh-CN'}]).lang, 'zh-CN');
  assert.strictEqual(picked([{lang: 'en'}, {lang: 'zh-HK'}]).lang, 'zh-HK');
  assert.strictEqual(picked([{lang: 'en-US'}, {lang: 'ja-JP'}]), null);
});

test('speak: cancel 先于 speak; lang/rate/pitch 落值', () => {
  const log = [];
  mkSpeech(mkSyn(log), mkU).speak('测试');
  assert.strictEqual(log[0], 'cancel');
  assert.strictEqual(log[1][0], 'speak');
  const u = log[1][1];
  assert.strictEqual(u.text, '测试');
  assert.strictEqual(u.lang, 'zh-CN');
  assert.strictEqual(u.rate, 0.9);
  assert.strictEqual(u.pitch, 1.1);
});

test('null synthesis: speak/cancel 静默不抛', () => {
  const k = mkSpeech(null, mkU);
  assert.doesNotThrow(()=> k.speak('x'));
  assert.doesNotThrow(()=> k.cancel());
});

test('onvoiceschanged 挂钩: synthesis 存在时注册重挑函数', () => {
  const syn = mkSyn([]);
  mkSpeech(syn, mkU);
  assert.strictEqual(typeof syn.onvoiceschanged, 'function');
});

test('onvoiceschanged 重挑: 初值无 zh voice 不带, 异步填充后 speak 换上新挑中的 voice', () => {
  const log = [];
  let voices = [{lang: 'en-US'}]; // 浏览器 getVoices() 异步填充, 初值常为空/不含 zh
  const syn = {
    getVoices() {
      return voices;
    },
    cancel() {
      log.push('cancel');
    },
    speak(u) {
      log.push(['speak', u]);
    },
    onvoiceschanged: null,
  };
  const k = mkSpeech(syn, mkU);
  k.speak('a');
  assert.strictEqual(log[1][1].voice, null, '初始无 zh voice → 不带 voice');
  voices = [{lang: 'en-US'}, {lang: 'zh-CN'}];
  syn.onvoiceschanged(); // 浏览器填好声音后触发重挑
  k.speak('b');
  assert.strictEqual(log[3][1].voice.lang, 'zh-CN', '重挑后 speak 带上 zh-CN');
});
