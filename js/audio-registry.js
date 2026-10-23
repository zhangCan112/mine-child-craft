'use strict';
/* ============================================================
   声音清单注册表 (AudioRegistry, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   游戏声音的唯一权威清单: SFX 音效条目(kind → 样本文件或合成定义,
   附双端增益/优先级/同类冷却)、BGM 曲目表、模式→情绪映射。
   播放器只按条目解释发声(标 file 走样本、标 synth 走合成兜底),
   不再自持清单; 加音效/换样本 = 这里改一行数据, 手滑(漏登记/
   死文件/情绪值拼错)由 test/audio-registry.test.js 扫源码调用量
   与资产存在性逐条断言, 与 mode-registry 同一套执行哲学。
   MOODS 的键是应用层模式 id 的字符串镜像(不依赖 mode-registry
   模块本体, 一致性由单测断言) — 引擎层数据, 应用层读它合法。
   interface: SFX_KINDS / MUSIC_TRACKS / MOODS / AudioRegistry(命名空间)
   依赖(均经全局名, 调用期解析): 无 — 纯数据表, 任何加载序可用
   可测性声明: 零 THREE·零 DOM·有单测(test/audio-registry.test.js)
   ============================================================ */

/* ---------- SFX 音效条目: 只收活着的 kind ----------
   每条: {synth|file 二选一, g, gTouch, prio, coolMs}
   - synth: 合成定义(自 effects.js 的 SFX_DEFS 原样迁入, A4 的合成
     解释器按原播放路径消费); win 为双振荡器琶音特例(special:'win',
     解释器内联 523→659→784 双振荡器逻辑, 不走单振荡器通用路径)。
   - file: 样本文件名(assets/audio/ 下), 本单一律未填 — A7 素材入库
     时逐条补, 补上后样本优先, 加载/解码失败自动落回 synth(游戏永不哑)。
   - g/gTouch: 桌面/触屏两档条目级响度倍率。本单中性 1 起步: 合成
     路径响度由 synth 内 g 配平(迁移期听感不变), 触屏总线级衰减
     (sfxBus 0.9/0.8 + 高通)收在 A3 的 AUDIO_MIX, 不在此叠加;
     A7 样本入库后按 loudnorm 归一结果逐条校准两档。
   - prio: 发声满员时的抢占优先级(VoiceGate: 新声 prio 严格大于
     最老活跃声才抢占), 数字大者优先, 分层 = 4 仪式(升级/胜利) >
     3 受击与死亡(玩家侧重要反馈) > 2 爆发(爆炸/闪电/怒吼/龙息) >
     1 高频打击与UI反馈(混战中最可丢的一档)。
   - coolMs: 同类冷却窗(防大混战同声叠加爆音), 沿用现 sfx() 的
     60ms; win 仪式音豁免冷却(现实现即如此) — 0。
   TNT 密室下线后的死键(fss 引线嘶声/door 铁门/splash 水花)无
   调用点, 不迁入; 若复活 TNT 模式, 重新登记而非默认保留。 */
const SFX_KINDS = {
  boom: {synth: {noise: {type: 'lowpass', freq: 420, dur: 0.5}, g: 0.2}, g: 1, gTouch: 1, prio: 2, coolMs: 60}, // g 0.4→0.2: 与其他音效重新配平, 给压限器留余量
  hit: {synth: {type: 'square', f0: 170, f1: 80, fT: 0.08, dur: 0.09, g: 0.08}, g: 1, gTouch: 1, prio: 1, coolMs: 60},
  hurt: {synth: {type: 'sawtooth', f0: 340, f1: 110, fT: 0.12, dur: 0.14, g: 0.10}, g: 1, gTouch: 1, prio: 3, coolMs: 60}, // 玩家受击(比 hit 更"疼", 与打怪音区分)
  shoot: {synth: {type: 'square', f0: 820, f1: 300, fT: 0.07, dur: 0.08, g: 0.04}, g: 1, gTouch: 1, prio: 1, coolMs: 60},
  zap: {synth: {type: 'sawtooth', f0: 1900, f1: 180, fT: 0.13, dur: 0.15, g: 0.09}, g: 1, gTouch: 1, prio: 2, coolMs: 60}, // 闪电劈落(高频锯齿急坠)
  death: {synth: {type: 'sawtooth', f0: 150, f1: 48, fT: 0.28, dur: 0.30, g: 0.10}, g: 1, gTouch: 1, prio: 3, coolMs: 60},
  breath: {synth: {type: 'sawtooth', f0: 300, f1: 90, fT: 0.35, dur: 0.40, g: 0.07}, g: 1, gTouch: 1, prio: 2, coolMs: 60},
  pick: {synth: {type: 'sine', steps: [880, 1318], dur: 0.22, g: 0.12}, g: 1, gTouch: 1, prio: 1, coolMs: 60}, // 拾取叮咚(两音)
  click: {synth: {type: 'square', f0: 1200, dur: 0.05, g: 0.07}, g: 1, gTouch: 1, prio: 1, coolMs: 60}, // 转辙器咔哒(专注训练营答错反馈同用)
  roar: {synth: {type: 'sawtooth', f0: 110, f1: 45, fT: 0.35, dur: 0.40, g: 0.14}, g: 1, gTouch: 1, prio: 2, coolMs: 60}, // 僵尸狂暴怒吼
  level: {synth: {type: 'sine', steps: [660, 880, 1320], stepT: 0.08, dur: 0.42, g: 0.12}, g: 1, gTouch: 1, prio: 4, coolMs: 60}, // 晋升琶音
  win: {synth: {special: 'win'}, g: 1, gTouch: 1, prio: 4, coolMs: 0}, // 胜利和弦: 双振荡器琶音特例(解释器内联), 仪式音豁免同类冷却
};

/* ---------- BGM 曲目表 ----------
   每条: trackId → {file(assets/audio/ 下文件名), mood, g 曲目增益}。
   本单空表 — A7 素材入库时填(CC0, 逐条入 CREDITS.md); 空表期间
   MusicDirector 恒 idle 不出声, 结构先行(测试已就位: file 存在性/
   CREDITS 覆盖/条目形状, 填入即咬合)。 */
const MUSIC_TRACKS = {};

/* ---------- 模式→BGM 情绪映射 ----------
   键 = 模式 id(js/mode-registry.js 全集的字符串镜像) + 'menu'(主菜单,
   非模式); 值 ∈ {calm 轻柔, battle 战斗, dark 阴暗, none 无配乐}。
   focus(专注训练营)=none: 配乐与反馈音争注意力, 注意力训练哲学
   (spec 拍板)。新模式入 mode-registry 而忘了在此声明情绪, 单测即红。 */
const MOODS = {
  menu: 'calm', // 主菜单轻柔迎接(spec 故事 9)
  arena: 'battle',
  focus: 'none',
  build: 'calm',
  tank: 'battle',
  nether: 'dark',
  adventure: 'dark',
};

/* CommonJS 导出守卫(mode-registry 同款): 浏览器经典脚本共享词法
   环境, 顶层 const 即全局, 供播放器/组合根直接引用; Node 下仅测试
   消费, 挂 module.exports */
const AudioRegistry = {SFX_KINDS, MUSIC_TRACKS, MOODS};
if (typeof module !== 'undefined' && module.exports) module.exports = AudioRegistry;
