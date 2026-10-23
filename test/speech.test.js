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

/* ---------- A6 说话起止钩子(BGM duck 让路) ----------
   fake synthesis 只入队不派发, 测试手动调 utterance 的
   onstart/onend 模拟浏览器; 钩子与 fake 写同一 log 以钉时序 */
test('A6 钩子: 说话起→onStart, 正常说完→onEnd; 入队不等于开口', () => {
  const log = [];
  const fired = [];
  const k = mkSpeech(mkSyn(log), mkU, {
    onStart: () => fired.push('start'),
    onEnd: () => fired.push('end'),
  });
  k.speak('你好');
  assert.deepStrictEqual(fired, [], 'speak 只入队, 钩子由 onstart 驱动');
  log[1][1].onstart();
  assert.deepStrictEqual(fired, ['start'], '开口即发 start(duck true)');
  log[1][1].onend();
  assert.deepStrictEqual(fired, ['start', 'end'], '说完即发 end(duck false)');
});

test('A6 钩子: speak 打断前一句 → 前句 end 兜底, 且先于新句 start', () => {
  const log = [];
  const k = mkSpeech(mkSyn(log), mkU, {
    onStart: () => log.push('duck-on'),
    onEnd: () => log.push('duck-off'),
  });
  const spoken = () => log.filter((e) => Array.isArray(e)).map((e) => e[1]);
  k.speak('第一句');
  spoken()[0].onstart(); // 前句开口(音乐已让路)
  k.speak('第二句'); // cancel-then-speak 打断前句
  spoken()[1].onstart(); // 新句开口
  assert.deepStrictEqual(
      log.map((e) => Array.isArray(e) ? 'speak' : e),
      ['cancel', 'speak', 'duck-on', 'duck-off', 'cancel', 'speak', 'duck-on'],
      '打断即兜底 end(回升), 且先于新句 start(再压) — 音乐不压着不回升');
});

test('A6 钩子: 打断后浏览器迟到补发的前句 onend 被溯源挡掉, 不误伤新句', () => {
  const log = [];
  const fired = [];
  const k = mkSpeech(mkSyn(log), mkU, {
    onStart: () => fired.push('start'),
    onEnd: () => fired.push('end'),
  });
  k.speak('前');
  log[1][1].onstart();
  k.speak('后');
  log[3][1].onstart();
  log[1][1].onend(); // 浏览器对被 cancel 前句的迟到 onend
  assert.deepStrictEqual(fired, ['start', 'end', 'start'], '迟到 onend 不双发、不提前回升');
  log[3][1].onend(); // 新句正常说完
  assert.deepStrictEqual(fired, ['start', 'end', 'start', 'end'], '新句自己的 onend 正常收尾');
});

test('A6 钩子: cancel 打断在说的话 → end 兜底', () => {
  const log = [];
  const fired = [];
  const k = mkSpeech(mkSyn(log), mkU, {
    onStart: () => fired.push('start'),
    onEnd: () => fired.push('end'),
  });
  k.speak('在说');
  log[1][1].onstart();
  k.cancel();
  assert.deepStrictEqual(fired, ['start', 'end'], 'cancel 路径同样有 end 兜底');
  k.cancel(); // 已停后再 cancel 不双发
  assert.deepStrictEqual(fired, ['start', 'end']);
});

test('A6 钩子: 未传 hooks(既有两参形态)零破坏, onstart/onend 照挂不抛', () => {
  const log = [];
  const k = mkSpeech(mkSyn(log), mkU);
  k.speak('x');
  assert.doesNotThrow(() => log[1][1].onstart());
  assert.doesNotThrow(() => log[1][1].onend());
  assert.strictEqual(log[1][1].text, 'x');
});
