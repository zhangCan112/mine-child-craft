'use strict';
/* ============================================================
   音频引擎 (AudioMixer, 术语见 GLOSSARY.md) — 引擎层 adapter
   ------------------------------------------------------------
   全部声音的唯一出口: AudioContext 生命周期(手势解锁 + interrupted/
   回前台恢复)、双总线音频图(音效/音乐分账)、样本懒加载与合成兜底解释器、
   坦克引擎嗡鸣、BGM 调度执行器(MusicDirector 事件流 → 真实节点启停)。
   "何时允许一声 / 何时起停音乐"的决策在 audio-core(有单测), 声音清单在
   audio-registry(条目标 file 走样本, 无 file/加载失败自动落合成, 游戏
   永不哑); 本文件只做装配与执行。调用面 sfx/engineHum 全局签名不变
   (自 effects.js 音效段迁入, 60+ 调用点零改动)。
   interface: AudioMixer{sfx,engineHum,setMood,setMusicVol,setSfxVol,duck,tick,preload} / sfx / engineHum / unlockAudio
   依赖(均经全局名): config.js 的 IS_TOUCH · audio-registry.js 的 SFX_KINDS/MUSIC_TRACKS ·
     audio-core.js 的 AUDIO_MIX/mkVoiceGate/mkMusicDirector/mkVolState/musicBusTarget —
     均须先于本文件加载(本文件顶层即取值建 gate/director/音量账本)
   可测性声明: WebAudio/DOM 全部调用期惰性创建, Node 测试可安全加载; adapter 无直测, 经 boot 冒烟覆盖(conventions §1.9)
   ============================================================ */

let actx = null; // 懒创建; iOS 须在用户手势内创建+resume 才能真正出声(见 unlockAudio)
let master = null; // 总增益: sfxBus/musicBus 两路汇此 → 压限器 → 扬声器(plan §3.2 总线图)
let sfxBus = null; // 音效总线(桌面 0.9/触屏 0.8; 触屏再前置 ~160Hz 高通)
let musicBus = null; // 音乐总线(桌面 0.30/触屏 0.25, duck 时压 min(基线×倍率, 0.08)) — 起停/让路/淡变全在这层
/* 音量倍率账本(B10/B13): 0..1 钳制与双端基线快照收在 audio-core 的
   mkVolState, 倍率/基线/钳制不再各处手写; 无存储注入 — 持久化实例在
   audio-vol-ui, 滑杆值经 setMusicVol/setSfxVol 链路同步进来 */
const volState = mkVolState({isTouch: IS_TOUCH});
let directorStarted = false; // BGM 计时起步只发一次(menu 口径 5~30s 首曲从此走)
let audioPreloaded = false; // 首次走通 context running 后自动 preload 一次(A9): 标记先行防重入(preload 内部再调 unlockAudio)
/* pad 小喇叭发不动低频: 触屏检测口径统一在 config.js 的 IS_TOUCH */

/* 手势解锁(常驻监听): 非手势创建/恢复的 context 在 iOS 上保持 suspended,
   挂起期间按冻结的 currentTime 排队的事件会在恢复瞬间同时炸响(爆音),
   故创建+resume+播静音采样都收在 pointerdown/touchstart/keydown 手势栈内;
   常驻而非 once: 切后台/来电中断回来 context 会再次挂起, 每次手势都要续。
   iOS 专属 'interrupted' 态(来电/闹钟)与 suspended 同样走 resume。 */
function unlockAudio() {
  try {
    if (!actx) {
      actx = new (window.AudioContext||window.webkitAudioContext)();
      /* 压限器回调"保险丝"定位(research A.5): DynamicsCompressor 自带只随
         threshold/knee/ratio 走的固定 makeup gain, 原 -12/20/12 比规范默认
         (-24/30/12) 激进一倍 — 常驻低电平源(引擎嗡鸣)被持续抬高, 每次音效
         attack/release 都跟着"呼吸"(pumping); 收回 -18/24/8 只兜混战峰值,
         混音层级交还各音源自身增益 */
      const comp = actx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 8;
      comp.attack.value = 0.003; comp.release.value = 0.25;
      /* master 0.8: 压限器 makeup gain 收敛后再让一档 headroom,
         多路方波+白噪叠加的瞬时峰值远离 ±1 — 目标节点超界行为规范未定义,
         在 iOS 小喇叭上即破音(research A.5 §5.1/§5.2) */
      master = actx.createGain(); master.gain.value = AUDIO_MIX.master;
      master.connect(comp); comp.connect(actx.destination);
      /* 双总线(plan §3.2): 音效/音乐分账 — 音效可叠可抢可滤, 音乐走自己的
         基线/让路/淡变; 两路再汇 master。总线基准取 AUDIO_MIX 双端两档 */
      sfxBus = actx.createGain();
      sfxBus.gain.value = volState.baseline().sfx * volState.sfx(); // 双端基线快照 × 音效倍率(B10: 不再手写 IS_TOUCH 三元)
      /* pad 扬声器频响: ~160Hz 以下频段小喇叭发不出, 白占 headroom 还逼
         锥体冲程发劈(research A.8 移动端混音检查单)。高通只挂音效总线前置
         (A1 校正③): 音乐低频是内容, spec 总线图明确不滤 */
      if (IS_TOUCH) {
        const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160;
        sfxBus.connect(hp); hp.connect(master);
      } else {
        sfxBus.connect(master);
      }
      /* 音乐总线从 0 起步: 开闸时机交给 MusicDirector 的 start/gain 事件,
         一切总线增益变化一律 setTargetAtTime 平滑过渡(spec 音频图纪律) */
      musicBus = actx.createGain(); musicBus.gain.value = 0;
      musicBus.connect(master);
    }
    if (actx.state === 'suspended' || actx.state === 'interrupted') {
      actx.resume();
      const s = actx.createBufferSource(); // 1 采样静音: 逼 iOS 立即开动渲染管线
      s.buffer = actx.createBuffer(1, 1, actx.sampleRate);
      s.connect(master); s.start(0);
      dropOnEnd(s); // 静音采样也是一次性音源: 每次手势续命都会新建, 播完即摘
    }
    if (!directorStarted) {
      /* BGM 计时起步只发一次: 真正推进要等 context running(tick 里有闸),
         提前起步无害 — 挂起期间导演时钟本来就冻结(挂起不排队纪律) */
      directorStarted = true;
      musicDir.unlock();
    }
    if (!audioPreloaded && actx && actx.state === 'running') {
      /* 首次真正走通(context running)即自动预热样本缓存一次(A4 跨单备注
         本意): 消灭"首播必走合成"。标记先行防重入 — preload 内部又会调
         unlockAudio; iOS 首手势 resume 是异步的, running 前不预热,
         下一次手势/sfx 重试直到走通 */
      audioPreloaded = true;
      AudioMixer.preload();
    }
  } catch (e) {}
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('pointerdown', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);
  document.addEventListener('keydown', unlockAudio);
  /* 回前台恢复(research A.2): iOS 切后台/锁屏/来电会把 context 打成
     suspended 或专属 'interrupted', visibilitychange 回前台补一手 resume —
     只恢复不排队(排队的音效会在恢复瞬间扎堆炸响, 纪律保持) */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && actx && actx.state !== 'running') {
      actx.resume();
    }
  });
}

/* 一次性音源播完即从音频图摘除(WebKit Bug 222098 官方 workaround):
   已播完仍连着的节点不会被及时回收, 音频图随游玩持续膨胀, 累积上千节点后
   渲染线程实时算力不支(spec §7.4 glitch) → "越玩越劈"的渐进式爆音。
   挂在链上最后结束的节点, 播完把整条链一起 disconnect */
function dropOnEnd(end, ...chain) {
  end.onended = () => {
    end.disconnect();
    for (const n of chain) n.disconnect();
  };
}

/* ---------- 发声准入接线: VoiceGate 决策 → 真实节点启停 ----------
   同类冷却/满员抢占的判断在 audio-core(有单测), 本层把 admit 的
   {act, victim} 结构化返回翻译成节点操作(A3 备注①): play=起声,
   steal=先停被抢声, ignore=静默; 一次性声部播完/被停时归还名额 */
const voiceGate = mkVoiceGate({max: IS_TOUCH ? 8 : 12}); // 触屏 ≤8 / 桌面 ≤12(spec 发声上限)
const activeVoices = new Map(); // kind → 声部句柄 {end, stop}(steal 停声用)

/* 声部收尾: 断连整条链(Bug 222098) + 归还 VoiceGate 名额。
   同 kind 后声已覆盖前声时名额归后声管, 前声结束不误还(免超发一声) */
function voiceOnEnd(kind, end, ...chain) {
  end.onended = () => {
    end.disconnect();
    for (const n of chain) n.disconnect();
    const cur = activeVoices.get(kind);
    if (!cur || cur.end === end) {
      voiceGate.release(kind);
      activeVoices.delete(kind);
    }
  };
  return {
    end,
    /* 停声(抢占用): 对链上每个源节点调 stop, 已停的抛 InvalidStateError 吞掉;
       断连与名额归还统一走 onended 异步收尾, 不重复管理 */
    stop() {
      for (const n of [end, ...chain]) {
        if (n.stop) {
          try {
            n.stop();
          } catch (e) {}
        }
      }
    },
  };
}

/* 抢占停声: victim 声部查表停源(gate 侧 admit 时已除名, release 幂等无害) */
function stopVoice(kind) {
  const v = activeVoices.get(kind);
  if (v) v.stop();
}

/* 带线性衰减的白噪声 buffer 按时长缓存: 以前每次爆炸现生成 2 万+ 随机数,
   大规模混战高频分配 → GC 尖刺 → 音频毛刺; 现只生成一次常驻复用 */
const noiseBufs = {};
function noiseBuf(dur) {
  if (!noiseBufs[dur]) {
    const buf = actx.createBuffer(1, Math.floor(actx.sampleRate*dur), actx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i=0; i<ch.length; i++) ch[i] = (Math.random()*2-1)*(1-i/ch.length);
    noiseBufs[dur] = buf;
  }
  return noiseBufs[dur];
}

/* ---------- 样本路径(为 A7 备好): 懒加载 fetch → decodeAudioData → Map 缓存 ----------
   降级链(spec): 条目无 file / fetch 失败(file:// 无 fetch) / 解码失败(旧
   iPad) → 任一环断都自动落合成路径, 游戏永不哑。decodeAudioData 用
   callback 形式包 Promise — 旧 Safari 的 Promise 版会 reject null
   (research A.2 怪癖), 双端只认成功回调拿到的真 buffer;
   用哪个 context 播就用哪个 context 解码(spec 采样率纪律) */
const sampleCache = new Map(); // file → AudioBuffer | null(null=失败标记, 该条永走合成)
const sampleLoads = new Map(); // file → Promise(并发去重)

function decodeAudio(bytes) {
  return new Promise((resolve, reject) => {
    try {
      actx.decodeAudioData(bytes, resolve, (e) => reject(e || new Error('decode failed')));
    } catch (e) {
      reject(e);
    }
  });
}

function loadSample(file) {
  if (!sampleLoads.has(file)) {
    sampleLoads.set(file, fetch('assets/audio/' + file).then((r) => r.arrayBuffer())
        .then((bytes) => decodeAudio(bytes))
        .then((buf) => {
          sampleCache.set(file, buf);
          return buf;
        })
        .catch(() => {
          sampleCache.set(file, null); // 失败标记: 该条此后永走合成兜底, 不反复撞墙
          return null;
        }));
  }
  return sampleLoads.get(file);
}

/* 样本播放器: 统一 5ms 线性淡入(防点击噪, spec 响度纪律) + 播完断连归还
   名额; 双端增益 g/gTouch 在此相乘(A7 样本按 loudnorm 归一结果逐条校准) */
function playSample(kind, e, buf) {
  const t = actx.currentTime;
  const src = actx.createBufferSource(); src.buffer = buf;
  const g = actx.createGain();
  src.connect(g); g.connect(sfxBus);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(IS_TOUCH ? e.gTouch : e.g, t + 0.005);
  src.start(t);
  activeVoices.set(kind, voiceOnEnd(kind, src, g));
}

/* ---------- 合成兜底解释器: SFX_KINDS[].synth 定义 → WebAudio 节点 ----------
   播放路径自 effects.js 的 SFX_DEFS 解释段原样迁入(迁移期听感不变);
   条目 g/gTouch 双端倍率在此相乘(现恒 1)。振荡器型/噪声型/win 双振荡器
   特例(special:'win')三分支 */
function playSynth(kind, d, mul) {
  const t = actx.currentTime;
  if (d.noise) { // 噪声型: 滤波白噪(衰减 buffer 按时长缓存)
    const src = actx.createBufferSource(); src.buffer = noiseBuf(d.noise.dur);
    const f = actx.createBiquadFilter(); f.type = d.noise.type; f.frequency.value = d.noise.freq;
    const g = actx.createGain();
    src.connect(f); f.connect(g); g.connect(sfxBus);
    g.gain.setValueAtTime(d.g*mul, t);
    src.start(t);
    activeVoices.set(kind, voiceOnEnd(kind, src, f, g)); // 播完摘除断连(Bug 222098): 混战高频爆炸也不积图
    return;
  }
  const g = actx.createGain(); g.connect(sfxBus);
  if (d.special === 'win') { // 胜利和弦: 双正弦琶音 523→659→784
    const o1 = actx.createOscillator(); o1.connect(g);
    const o2 = actx.createOscillator(); o2.connect(g);
    o1.type = o2.type = 'sine';
    o1.frequency.setValueAtTime(523, t); o1.frequency.setValueAtTime(659, t+0.16);
    o2.frequency.setValueAtTime(784, t+0.32);
    g.gain.setValueAtTime(0.12*mul, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.85);
    o1.start(t); o1.stop(t+0.85); o2.start(t+0.32); o2.stop(t+0.85);
    activeVoices.set(kind, voiceOnEnd(kind, o2, o1, g)); // 双振荡器同刻收尾: 挂 o2, 连 o1/g 整链摘除
    return;
  }
  const o = actx.createOscillator(); o.connect(g); // 振荡器型
  o.type = d.type;
  if (d.steps) { // 多音定格(叮咚/琶音)
    for (let i=0; i<d.steps.length; i++) {
      o.frequency.setValueAtTime(d.steps[i], t + (d.stepT||0)*i);
    }
  } else if (d.f0 !== undefined) {
    o.frequency.setValueAtTime(d.f0, t);
    if (d.f1 !== undefined) {
      const fT = d.fT !== undefined ? d.fT : d.dur;
      if (d.linear) o.frequency.linearRampToValueAtTime(d.f1, t+fT);
      else o.frequency.exponentialRampToValueAtTime(d.f1, t+fT);
    }
  }
  g.gain.setValueAtTime(d.g*mul, t);
  g.gain.exponentialRampToValueAtTime(0.001, t+d.dur);
  o.start(t); o.stop(t+d.dur);
  activeVoices.set(kind, voiceOnEnd(kind, o, g)); // 播完摘除断连(Bug 222098)
}

/* ---------- 全局音效入口(签名不变, 调用点零改动) ----------
   决策序: 先查表(未登记 kind 静默返回, 不建任何节点 — 根治早退路径孤儿
   gain, A1 校正②) → VoiceGate 准入(同类冷却/满员抢占, 替代原 60ms 手写
   节流表) → 样本优先, 无 file/未就绪/加载失败落合成兜底 */
function sfx(kind) {
  try {
    const e = SFX_KINDS[kind];
    if (!e) return;
    const v = voiceGate.admit(kind, e.prio, e.coolMs);
    if (v.act === 'ignore') return;
    if (v.act === 'steal') stopVoice(v.victim); // 抢占: 停进入时刻最老活跃声(A3 备注①)
    unlockAudio();
    if (!actx || actx.state !== 'running') {
      voiceGate.release(kind); // 挂起中不排队(纪律保持): 名额还回去, 免幽灵占位
      return;
    }
    if (e.file !== undefined) {
      const buf = sampleCache.get(e.file);
      if (buf) {
        playSample(kind, e, buf);
        return;
      }
      loadSample(e.file); // 未就绪: 后台拉取, 本次先走合成(下次命中走样本)
    }
    playSynth(kind, e.synth, IS_TOUCH ? e.gTouch : e.g);
  } catch (e) {}
}

/* ---------- 坦克引擎嗡鸣: 连续音, level 0..1(怠速微响 → 油门渐强渐升) ----------
   level 量化后比较, 同值免重设; 停驶/下车/切模式须传 0 归零 */
let humOsc = null; let humGain = null; let humLvl = -1;
let humFilt = null; let humLfo = null; let humDepth = null;
function engineHum(level) {
  try {
    unlockAudio();
    if (!actx || actx.state !== 'running') return; // 挂起中不动 humLvl: 恢复后同油门也能续上嗡鸣
    const q = Math.round(level*8)/8; // 8 级量化: 油门离散档, 免连续值逐帧重设
    if (q === humLvl) return;
    humLvl = q;
    if (!humOsc) {
      /* 频段重设计(iPad 杂音首要嫌疑, research A.8-1): 旧基频 52~98Hz 低于
         pad 扬声器可重放限, 小喇叭还原不了只剩失真与机身共振; 上移到
         120~250Hz 发得出的频段, lowpass 260 换成中心跟随基频的 bandpass —
         滤掉锯齿高频毛刺也压掉残余次低频, 能量收在喇叭干得动的窄带里 */
      humOsc = actx.createOscillator(); humOsc.type = 'sawtooth';
      humFilt = actx.createBiquadFilter(); humFilt.type = 'bandpass'; humFilt.Q.value = 1;
      humGain = actx.createGain(); humGain.gain.value = 0;
      /* 幅度调制补"体积感": 单频连续音在小喇叭上干瘪, ~6Hz 微颤让嗡鸣像
         机器在呼吸; LFO 加法调制 humGain.gain, 深度随油门同步缩放,
         怠速近零不在弱信号里起波澜 */
      humLfo = actx.createOscillator(); humLfo.frequency.value = 6;
      humDepth = actx.createGain(); humDepth.gain.value = 0;
      humLfo.connect(humDepth); humDepth.connect(humGain.gain);
      humOsc.connect(humFilt); humFilt.connect(humGain); humGain.connect(sfxBus); // 引擎声也是音效: 走 sfxBus(触屏随总线过高通)
      humOsc.start(); humLfo.start();
    }
    const t = actx.currentTime;
    /* pad 小喇叭还原低频只会嗡嗡失真: 触屏设备引擎嗡鸣增益减半(政策保留)。
       q=0(停驶/下车/切模式)必须真静音: 早期版本留 g0 怠速地板, 开过一次坦克
       回主菜单后 120Hz 蜂鸣永驻耳机(2026-10-23 用户实测"一直有嗡嗡声"),
       引擎声改为随车速从零渐起——零速即无声, 静止怠速鸣响不再保留 */
    const g0 = IS_TOUCH ? 0.022 : 0.045; const gk = IS_TOUCH ? 0.045 : 0.085;
    const lv = q <= 0 ? 0 : g0 + q*gk;
    humGain.gain.setTargetAtTime(lv, t, 0.12);
    humDepth.gain.setTargetAtTime(lv*0.18, t, 0.12); // ±18% 轻微颤幅, 与油门同比例
    const f0 = 120 + q*130; // 基频 52~98Hz → 120~250Hz 可重放频段
    humOsc.frequency.setTargetAtTime(f0, t, 0.18);
    humFilt.frequency.setTargetAtTime(f0, t, 0.18); // 带通中心跟随基频
  } catch (e) {}
}

/* ---------- BGM 调度执行器: MusicDirector 事件流 → 真实节点 ----------
   决策(何时起/停/让路)在 audio-core 的 musicDir(有单测), 本层翻译事件:
   start=解码一次性播放(不循环, 播完丢引用回收 PCM; 曲目条目缺 durMs 时用
   AudioBuffer.duration 预填进副本条目 — A3 备注②, 判曲毕唯一依据;
   director 消费的是注册表条目的浅副本, 运行时回写不落注册表 — 纯数据);
   stop=曲已淡出, 停源断链; gain=musicBus 开闸到目标(一切变化
   setTargetAtTime)。空曲表时 director 恒 idle, 本段结构就绪不出声
   (A7 填曲后自然生效); 音乐不进 sampleCache — 同时最多解码一首(plan §3.3) */
/* 条目浅副本(A6 注册表纯数据): durMs 预填/死曲短命等运行时回写落副本;
   死曲可从此表摘除 */
const trackList = Object.values(MUSIC_TRACKS).map((t) => ({...t}));
const musicDir = mkMusicDirector({
  tracks: trackList,
  gain: volState.baseline().music, // 总线基线双端两档(A3 备注⑤; B10 经 baseline() 取, 不再手写三元)
});
let musicSrc = null; // 当前一次性曲源(同时 ≤1 首, 播完丢引用)
let musicGain = null; // 当前曲目私有增益(曲目 g + 淡入), 与总线 duck/让路分层
let musicWant = null; // 起曲意图令牌: 解码等待期若已被停(换情绪淡出先到)则弃起

/* 总线增益目标换算: 换算纯函数 musicBusTarget 在 audio-core(有单测) —
   duck 深度 0.08 是"只降不升"的上限, 不是"抬到 0.08"的定值(A1 修复:
   音乐倍率 <0.27 或静音 0 时, TTS 开口不得反把总线抬响/让静音失效),
   其余基线目标按音乐音量倍率缩放(A8 滑杆消费) */
function musicGainTarget(target) {
  return musicBusTarget(target, volState.music(), volState.baseline().music);
}

/* 总线开闸: setTargetAtTime 时间常数取 ramp/3(~95% 到位), 平滑无爆点 */
function applyBusGain(target, rampMs) {
  musicBus.gain.setTargetAtTime(musicGainTarget(target), actx.currentTime, rampMs/3000);
}

/* 死曲处理: 拉取/解码失败的曲目标死并从池中摘除(后续选曲不再撞);
   给个短 durMs 让 director 尽快"曲毕"入静默换下一首(tr 是副本条目,
   注册表不回写 — A6) — BGM 侧的永不哑就是静默 */
function deadTrack(tr) {
  const i = trackList.indexOf(tr);
  if (i >= 0) trackList.splice(i, 1);
  if (!tr.durMs) tr.durMs = 1500;
}

function playTrack(tr, busGain, fadeInMs) {
  musicWant = tr;
  fetch('assets/audio/' + tr.file).then((r) => r.arrayBuffer())
      .then((bytes) => decodeAudio(bytes))
      .then((buf) => {
        if (musicWant !== tr) return; // 等待期已被停(切情绪淡出先到): 不再起声
        if (!tr.durMs) tr.durMs = Math.round(buf.duration*1000); // 曲目时长预填(A3 备注②; tr 是副本条目, 注册表不回写)
        const t = actx.currentTime;
        const src = actx.createBufferSource(); src.buffer = buf;
        const g = actx.createGain(); g.gain.value = 0;
        src.connect(g); g.connect(musicBus);
        /* 曲目私有淡入到曲目 g + 总线开闸到事件算好的目标(duck 已计入,
           A3 备注④), 淡入 1200ms 与淡出对称 */
        g.gain.setTargetAtTime(tr.g, t, fadeInMs/3000);
        applyBusGain(busGain, fadeInMs);
        src.onended = () => { // 播完/被停: 整链摘除, PCM 引用随丢(单首常驻)
          src.disconnect(); g.disconnect();
          if (musicSrc === src) {
            musicSrc = null; musicGain = null;
          }
        };
        musicSrc = src; musicGain = g;
        src.start(t);
      })
      .catch(() => deadTrack(tr));
}

function stopTrack() {
  musicWant = null;
  if (!musicSrc) return;
  const src = musicSrc;
  musicSrc = null; musicGain = null;
  try {
    src.stop(); // 淡出已完成(gain 事件先行于 stop, A3 备注③), 停源后 onended 收尾断链
  } catch (e) {}
}

/* ---------- 门面 AudioMixer: A5~A8 的接线面 ----------
   sfx/engineHum 与全局函数同源(签名不变); 其余入口本单为薄壳:
   setMood/duck 只改 director 状态, 事件从下一次 tick 的 pending 流出
   (A3 备注③); setMusicVol/setSfxVol 立即生效于总线倍率(A8 消费);
   tick 由主循环每帧驱动(A5 接线); preload 预热样本缓存(A7 消费) */
const AudioMixer = {
  sfx,
  engineHum,
  /* setMood(m): m ∈ MOODS 值集(calm/battle/dark/none)。同 mood 续播不打断,
     换 mood 曲中 1.2s 淡出后 15~45s 新曲; none 恒静默 */
  setMood(m) {
    musicDir.setMood(m);
  },
  /* setMusicVol(v): 0..1 音乐音量倍率(volState 钳制, B13); 让路深度是
     "只降不升"的上限, 不把压低/静音的总线抬响(musicBusTarget, A1)。
     曲目进行中立即重设总线, 其余场景下次 gain/start 事件自然带新倍率 */
  setMusicVol(v) {
    volState.setMusic(v);
    const s = actx && musicBus ? musicDir.snapshot() : null;
    if (s && s.state === 'playing') {
      applyBusGain(s.ducked ? AUDIO_MIX.duck : volState.baseline().music, 250);
    }
  },
  /* setSfxVol(v): 0..1 音效音量倍率(volState 钳制, B13), 总线基准 × 倍率平滑过渡 */
  setSfxVol(v) {
    volState.setSfx(v);
    if (actx && sfxBus) {
      sfxBus.gain.setTargetAtTime(volState.baseline().sfx*volState.sfx(),
          actx.currentTime, 0.05);
    }
  },
  /* duck(on): TTS 说话让路开关 — 压 0.08(0.25s)/回升(0.8s), 经 director
     下一次 tick 事件化执行(说话起→A6 钩子调 true, 说完→false) */
  duck(on) {
    musicDir.duck(on);
  },
  /* tick(dtMs): 主循环每帧驱动(毫秒增量)。挂起中不推进 — 导演时钟随
     context 冻结, 恢复后从剩余等待续跑(挂起不排队纪律) */
  tick(dtMs) {
    if (!actx || actx.state !== 'running') return;
    for (const ev of musicDir.tick(dtMs)) {
      if (ev.type === 'start') playTrack(ev.track, ev.gain, ev.fadeInMs);
      else if (ev.type === 'stop') stopTrack();
      else if (ev.type === 'gain') applyBusGain(ev.target, ev.rampMs);
    }
  },
  /* preload(): 预热全部样本条目(unlockAudio 首次走通 running 后已自动
     调用一次 — A9, 消灭"首播必走合成"; 失败条目自动永走合成)。
     BGM 曲目不预载 — 一次性按需解码, 省常驻 PCM 内存 */
  preload() {
    unlockAudio();
    for (const e of Object.values(SFX_KINDS)) {
      if (e.file !== undefined) loadSample(e.file);
    }
  },
};
