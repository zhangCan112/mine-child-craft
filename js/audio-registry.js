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
   TNT 密室下线后的死键(fss 引线嘶声/door 铁门)无调用点, 不迁入; 若复活 TNT
   模式, 重新登记而非默认保留。splash 水花死键已随液体系统复活(2026-10, 设计稿 liquid D10)。 */
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
  gem: {synth: {type: 'sine', steps: [1318, 1760, 2637], stepT: 0.09, dur: 0.5, g: 0.12}, g: 1, gTouch: 1, prio: 4, coolMs: 60}, // 钻石首获琶音(T15 仪式, 三音上行更闪; 2026-10-23 随 master 并入——定义原在 effects.js SFX_DEFS, 表迁册于此)
  win: {synth: {special: 'win'}, g: 1, gTouch: 1, prio: 4, coolMs: 0}, // 胜利和弦: 双振荡器琶音特例(解释器内联), 仪式音豁免同类冷却
  splash: {synth: {noise: {type: 'bandpass', freq: 900, dur: 0.25}, g: 0.12}, g: 1, gTouch: 1, prio: 1, coolMs: 120}, // 入水水花(液体系统复活死键, 设计稿 liquid D10; 带通白噪拟水声)
  lava_hiss: {synth: {noise: {type: 'highpass', freq: 2400, dur: 0.5}, g: 0.10}, g: 1, gTouch: 1, prio: 2, coolMs: 200}, // 水岩混合嘶嘶声(MC extinguish 口径, liquid D4.4)
  fuse: {synth: {noise: {type: 'highpass', freq: 1600, dur: 0.9}, g: 0.12}, g: 1, gTouch: 1, prio: 2, coolMs: 150}, // 苦力怕引信嘶声(副本 bomber 起燃; MC 点燃口径——白噪急嘶, 合成无样本)
  portal_charge: {synth: {type: 'sine', f0: 330, f1: 990, fT: 0.5, dur: 0.55, g: 0.10}, g: 1, gTouch: 1, prio: 4, coolMs: 200}, // 门面站桩蓄能(冒险地图 T7 §4.1 双段式第一段): 正弦上行滑音, 走出可反悔故 200ms 冷却防抖
  portal_travel: {synth: {type: 'sine', steps: [659, 988], stepT: 0.11, dur: 0.34, g: 0.12}, g: 1, gTouch: 1, prio: 4, coolMs: 60}, // 穿门到达(第二段, 遮罩满格切图时刻): 双音上行琶音与 TTS 播报并线
  gate_unlock: {synth: {type: 'sine', steps: [392, 523, 659, 784], stepT: 0.09, dur: 0.52, g: 0.12}, g: 1, gTouch: 1, prio: 4, coolMs: 0}, // 门点亮仪式(票据 T8 §2.3): 四音上行琶音(G 大调, 比 level 晋升琶音多一音更庄重), 与光束/TTS 同拍; 仪式音豁免同类冷却
  snow_throw: {synth: {noise: {type: 'lowpass', freq: 620, dur: 0.1}, g: 0.08}, g: 1, gTouch: 1, prio: 1, coolMs: 60}, // 雪球掷出「噗」(票据 T9; 低通白噪拟脱手闷响)
  snow_hit: {synth: {noise: {type: 'bandpass', freq: 1000, dur: 0.16}, g: 0.10}, g: 1, gTouch: 1, prio: 1, coolMs: 60}, // 雪球命中「噗嗤」(票据 T9; 带通白噪拟松雪散裂, 打雪仗零伤害的观感主反馈)
  sand_collapse: {synth: {noise: {type: 'lowpass', freq: 380, dur: 0.3}, g: 0.14}, g: 1, gTouch: 1, prio: 2, coolMs: 100}, // 神殿可疑地板踩塌(审查修复 P1; 低通白噪拟沙层坍落闷响, 比 snow_hit 低且长)
  door_swing: {synth: {type: 'square', f0: 180, f1: 95, fT: 0.09, dur: 0.12, g: 0.09}, g: 1, gTouch: 1, prio: 1, coolMs: 150}, // 木门开合「吱呀叩」(门/玻璃板设计稿 §4.4; 注意 kind 不是死键 'door' —— TNT 密室铁门音已清偿不迁, test 断言其缺席)
  bark: {synth: {type: 'square', f0: 420, f1: 140, fT: 0.09, dur: 0.13, g: 0.13}, g: 1, gTouch: 1, prio: 2, coolMs: 80}, // 狼嚎短吠(回声矿洞目标声, 2026-10 P1; 方波下坠拟"汪"感; 合成恒定音色=目标声不漂移, 调研 §A2)
  meow: {synth: {type: 'sine', f0: 760, f1: 480, fT: 0.22, dur: 0.3, g: 0.10}, g: 1, gTouch: 1, prio: 2, coolMs: 80}, // 猫叫(回声矿洞干扰声; 正弦缓滑与目标方波在音色上可分, 调研 §A2)
  shear: {synth: {noise: {type: 'highpass', freq: 1800, dur: 0.12}, g: 0.10}, g: 1, gTouch: 1, prio: 1, coolMs: 150}, // 剪羊毛「咔嚓」(剪毛使用档; 高通白噪短促拟剪刀开合, 与 hit 打击音区分)
};

/* ---------- BGM 曲目表 ----------
   每条: trackId → {file(assets/audio/ 下文件名), mood, g 曲目增益,
    durMs 实测时长毫秒}。CC0 八曲按场景分组(溯源与听感映射见
    assets/audio/CREDITS.md): calm=主菜单/建造 · adventure=上界白天 ·
    night=上界夜晚 · nether=下界 · battle=竞技场/坦克。
    2026-10-27 按用户"太阴间/开头大段空白"反馈整体换曲: 原三曲下线,
    改选 Minecraft 风格 calm/ambient 与明亮芯片曲; 开头与曲间空白同步
    缩短(SCHED 在 audio-core)。durMs 以 loudnorm 重转码(ADR 0003)后
    ffmpeg 实测 Duration 换算毫秒 — MusicDirector 判曲毕的唯一依据
    (A3 接口备注②), 执行器另有 AudioBuffer.duration 解码预填兜底
    (audio.js), 此处静态值保首拍即准。 */
const MUSIC_TRACKS = {
  'infinite-world': {file: 'bgm-infinite-world.m4a', mood: 'calm', g: 1, durMs: 86400}, // 00:01:26.40 钢琴合成器(菜单/建造)
  'calm-piano': {file: 'bgm-calm-piano.m4a', mood: 'calm', g: 1, durMs: 160660}, // 00:02:40.66 舒缓铺底+明亮钢琴(主菜单/建造)
  'flowerbed-fields': {file: 'bgm-flowerbed-fields.m4a', mood: 'adventure', g: 1, durMs: 39790}, // 00:00:39.79 可爱芯片(白天)
  'going-up': {file: 'bgm-going-up.m4a', mood: 'adventure', g: 1, durMs: 55000}, // 00:00:55.00 上行冒险芯片(上界白天)
  'morning-sky': {file: 'bgm-morning-sky.m4a', mood: 'night', g: 1, durMs: 132000}, // 00:02:12.00 夜间舒缓钢琴(上界夜晚)
  'seeing-pool': {file: 'bgm-seeing-pool.m4a', mood: 'nether', g: 1, durMs: 68920}, // 00:01:08.92 洞穴/地下水声 ambient(下界)
  '8bit-battle': {file: 'bgm-8bit-battle.m4a', mood: 'battle', g: 1, durMs: 26620}, // 00:00:26.62 短促 8-bit 战斗循环(竞技场/坦克)
  'rpg-battle': {file: 'bgm-rpg-battle.m4a', mood: 'battle', g: 1, durMs: 59080}, // 00:00:59.08 RPG 战斗循环(竞技场/坦克)
};

/* ---------- 主菜单 BGM 情绪 ----------
   引擎侧只需 menu 一个键: 各游玩模式的情绪唯一权威在 mode-registry 各行
   mood 字段(main.js switchMode 直接消费, 每行必声明由其单测断言), 此前的
   模式 id 镜像键已删——两处权威各改一半的漂移源一并拔除。值 ∈ {calm,
   adventure, night, nether, battle, none}; menu=calm: 主菜单轻柔迎接
   (spec 故事 9)。探险模式另在壳层按维度/昼夜动态切 night/nether。 */
const MOODS = {
  menu: 'calm', // 主菜单轻柔迎接(spec 故事 9)
};

/* CommonJS 导出守卫(mode-registry 同款): 浏览器经典脚本共享词法
   环境, 顶层 const 即全局, 供播放器/组合根直接引用; Node 下仅测试
   消费, 挂 module.exports */
const AudioRegistry = {SFX_KINDS, MUSIC_TRACKS, MOODS};
if (typeof module !== 'undefined' && module.exports) module.exports = AudioRegistry;
