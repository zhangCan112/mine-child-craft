'use strict';
/* ============================================================
   声音清单注册表 (AudioRegistry, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   游戏声音的唯一权威清单: SFX 音效条目(kind → 样本文件或合成定义,
   附双端增益/优先级/同类冷却)、BGM 曲目表、主菜单情绪 MOODS(仅 menu
   键 — 各游玩模式的情绪唯一权威在 mode-registry 各行 mood 字段)。
   播放器只按条目解释发声(标 file 走样本、标 synth 走合成兜底),
   不再自持清单; 加音效/换样本 = 这里改一行数据, 手滑(漏登记/
   死文件/情绪值拼错)由 test/audio-registry.test.js 扫源码调用量
   与资产存在性逐条断言, 与 mode-registry 同一套执行哲学。
   MOODS 仅存 menu(主菜单非模式): 模式情绪不再在此镜像 — 引擎层数据,
   应用层读它合法。
   interface: SFX_KINDS / MUSIC_TRACKS / MOODS / AudioRegistry(命名空间)
   依赖(均经全局名, 调用期解析): 无 — 纯数据表, 任何加载序可用
   可测性声明: 零 THREE·零 DOM·有单测(test/audio-registry.test.js)
   ============================================================ */

/* ---------- SFX 音效条目: 只收活着的 kind ----------
   每条: {file?, synth, g, gTouch, prio, coolMs}
   - synth: 合成定义(自 effects.js 的 SFX_DEFS 原样迁入, A4 的合成
     解释器按原播放路径消费); win 为双振荡器琶音特例(special:'win',
     解释器内联 523→659→784 双振荡器逻辑, 不走单振荡器通用路径)。
   - file: 样本文件名(assets/audio/ 下, A7 入库的 CC0 素材, 溯源见
      assets/audio/CREDITS.md)。标 file 样本优先, synth 原样保留做回退:
      未就绪(首播)/fetch 失败/file:// 场景自动落合成(audio.js 降级链
      消费 e.synth, 游戏永不哑), 共存形状由单测互锁。
   - g/gTouch: 桌面/触屏两档条目级响度倍率。本单中性 1 起步: 合成
     路径响度由 synth 内 g 配平(迁移期听感不变), 触屏总线级衰减
     (sfxBus 0.9/0.8 + 高通)收在 A3 的 AUDIO_MIX, 不在此叠加;
      A7 样本入库后暂维持 1, 样本与合成的响度差由 A10 听感复核校准。
   - prio: 发声满员时的抢占优先级(VoiceGate: 新声 prio 严格大于
     最老活跃声才抢占), 数字大者优先, 分层 = 4 仪式(升级/胜利) >
     3 受击与死亡(玩家侧重要反馈) > 2 爆发(爆炸/闪电/怒吼/龙息) >
     1 高频打击与UI反馈(混战中最可丢的一档)。
   - coolMs: 同类冷却窗(防大混战同声叠加爆音), 沿用现 sfx() 的
     60ms; win 仪式音豁免冷却(现实现即如此) — 0。
   TNT 密室下线后的死键(fss 引线嘶声/door 铁门/splash 水花)无
   调用点, 不迁入; 若复活 TNT 模式, 重新登记而非默认保留。 */
const SFX_KINDS = {
  boom: {file: 'impactplate-heavy-000.m4a', synth: {noise: {type: 'lowpass', freq: 420, dur: 0.5}, g: 0.2}, g: 1, gTouch: 1, prio: 2, coolMs: 60}, // g 0.4→0.2: 与其他音效重新配平, 给压限器留余量
  hit: {file: 'impactpunch-medium-000.m4a', synth: {type: 'square', f0: 170, f1: 80, fT: 0.08, dur: 0.09, g: 0.08}, g: 1, gTouch: 1, prio: 1, coolMs: 60},
  hurt: {file: 'impactsoft-heavy-000.m4a', synth: {type: 'sawtooth', f0: 340, f1: 110, fT: 0.12, dur: 0.14, g: 0.10}, g: 1, gTouch: 1, prio: 3, coolMs: 60}, // 玩家受击(比 hit 更"疼", 与打怪音区分)
  shoot: {file: 'knifeslice.m4a', synth: {type: 'square', f0: 820, f1: 300, fT: 0.07, dur: 0.08, g: 0.04}, g: 1, gTouch: 1, prio: 1, coolMs: 60},
  zap: {file: 'impactglass-light-000.m4a', synth: {type: 'sawtooth', f0: 1900, f1: 180, fT: 0.13, dur: 0.15, g: 0.09}, g: 1, gTouch: 1, prio: 2, coolMs: 60}, // 闪电劈落(高频锯齿急坠; 样本=轻玻璃爆裂的碎响感)
  death: {file: 'impactbell-heavy-000.m4a', synth: {type: 'sawtooth', f0: 150, f1: 48, fT: 0.28, dur: 0.30, g: 0.10}, g: 1, gTouch: 1, prio: 3, coolMs: 60}, // 样本=重钟闷响(丧钟感), 合成下滑锯齿兜底
  breath: {file: 'impactsoft-medium-000.m4a', synth: {type: 'sawtooth', f0: 300, f1: 90, fT: 0.35, dur: 0.40, g: 0.07}, g: 1, gTouch: 1, prio: 2, coolMs: 60},
  pick: {file: 'handlecoins.m4a', synth: {type: 'sine', steps: [880, 1318], dur: 0.22, g: 0.12}, g: 1, gTouch: 1, prio: 1, coolMs: 60}, // 拾取叮咚(两音); 样本=抖钱袋(拾币贴场景)
  click: {file: 'metalclick.m4a', synth: {type: 'square', f0: 1200, dur: 0.05, g: 0.07}, g: 1, gTouch: 1, prio: 1, coolMs: 60}, // 转辙器咔哒(专注训练营答错反馈同用); 样本=金属轻叩
  roar: {file: 'impactmetal-heavy-000.m4a', synth: {type: 'sawtooth', f0: 110, f1: 45, fT: 0.35, dur: 0.40, g: 0.14}, g: 1, gTouch: 1, prio: 2, coolMs: 60}, // 僵尸狂暴怒吼; 样本=重金属轰鸣(更贴方块世界)
  level: {synth: {type: 'sine', steps: [660, 880, 1320], stepT: 0.08, dur: 0.42, g: 0.12}, g: 1, gTouch: 1, prio: 4, coolMs: 60}, // 晋升琶音(仪式音保持合成: 琶音比打击样本更贴)
  win: {synth: {special: 'win'}, g: 1, gTouch: 1, prio: 4, coolMs: 0}, // 胜利和弦: 双振荡器琶音特例(解释器内联), 仪式音豁免同类冷却
};

/* ---------- BGM 曲目表 ----------
   每条: trackId → {file(assets/audio/ 下文件名), mood, g 曲目增益,
    durMs 实测时长毫秒}。A7 入库 CC0 三曲(calm/battle/dark 各一, 溯源
    与听感映射见 assets/audio/CREDITS.md): mood 为曲目名听感推断,
    A10 复核可调; durMs 以 loudnorm 重转码(ADR 0003)后 ffmpeg 实测
    Duration 换算毫秒 — MusicDirector 判曲毕的唯一依据(A3 接口备注②),
    执行器另有 AudioBuffer.duration 解码预填兜底(audio.js), 此处静态值保首拍即准。 */
const MUSIC_TRACKS = {
  'crickets': {file: 'bgm-crickets.m4a', mood: 'calm', g: 1, durMs: 209400}, // 00:03:29.40 蟋蟀夏夜环境
  'the-abyss': {file: 'bgm-the-abyss.m4a', mood: 'dark', g: 1, durMs: 147200}, // 00:02:27.20 深渊低回
  'volcano': {file: 'bgm-entering-the-volcano.m4a', mood: 'battle', g: 1, durMs: 128100}, // 00:02:08.10 火山行进
};

/* ---------- 主菜单 BGM 情绪 ----------
   引擎侧只需 menu 一个键: 各游玩模式的情绪唯一权威在 mode-registry 各行
   mood 字段(main.js switchMode 直接消费, 每行必声明由其单测断言), 此前的
   模式 id 镜像键已删——两处权威各改一半的漂移源一并拔除。值 ∈ {calm,
   battle, dark, none}; menu=calm: 主菜单轻柔迎接(spec 故事 9)。 */
const MOODS = {
  menu: 'calm', // 主菜单轻柔迎接(spec 故事 9)
};

/* CommonJS 导出守卫(mode-registry 同款): 浏览器经典脚本共享词法
   环境, 顶层 const 即全局, 供播放器/组合根直接引用; Node 下仅测试
   消费, 挂 module.exports */
const AudioRegistry = {SFX_KINDS, MUSIC_TRACKS, MOODS};
if (typeof module !== 'undefined' && module.exports) module.exports = AudioRegistry;
