# 游戏音频重建调研 —— iPad 杂音根因 × 录制音乐替换合成音

> 调研日期：2026-10-23。由两个独立调研合并：A 部分查 iOS Safari WebAudio 杂音根因与播放技术（一手 = 规范正文 / WebKit Bugzilla 与官方博客 / Apple 官方文档 / caniuse 原始数据）；B 部分查音乐素材来源与许可（许可结论均打开官网原页核对原文，Kenney 音乐包与 OGA 候选曲目实际下载解包验证）。
> 配套方案见 `docs/game-audio-plan.md`。

---

## A. iOS Safari WebAudio 杂音/破音与播放技术

背景：本项目纯 WebAudio 合成音效（OscillatorNode + 白噪 BufferSource → master Gain(0.9) → DynamicsCompressor(threshold -12, ratio 12) → destination），含常驻 sawtooth 引擎嗡鸣（52~98Hz 经 260Hz lowpass）。实测 iPad 内放杂音严重，桌面端尚可。

### A.1 已知根因（WebKit Bugzilla 一手记录）

**根因 A：已播完的 AudioBufferSourceNode 不及时从音频图移除 → 图膨胀 → 爆音（与本项目直接相关）**

- Bug 222098「Regression: Raw AudioBufferSourceNode playback causes repeated crackling sound」：Unity WebGL 与原生 JS 游戏在 Safari 14.1 起播放大量 AudioBufferSourceNode 数秒后开始爆音。WebKit 工程师 Chris Dumez 定位：WebKit 的 WebAudio 实现**依赖 JS GC 及时回收播完的节点 wrapper**；GC 跟不上时节点不被销毁，音频图持续增长，"once we reach ~2000 AudioBufferSourceNode, the audio gets bad"；到 12k–15k 个 wrapper 时 "audio quality starts to deteriorate and craters very quickly"。且连接到**需要 tail processing 的节点**（DelayNode、PannerNode，DynamicsCompressorNode 同类）时更易触发。官方 workaround 原话："**A temporary workaround for people until this fix ships would likely be to manually remove nodes from the graph once they are no longer useful**"（修复 r278233 于 2021-05 落地，但同 bug 后续评论仍有人报告 workaround 之外的场景复发）。[来源: https://bugs.webkit.org/show_bug.cgi?id=222098 — 一手，WebKit Bugzilla，含 WebKit 工程师诊断与补丁记录]
- 该 bug 被 Bug 227199 交叉引用为 "very relevant bug ... regarding memory management of AudioBufferSourceNodes"。[来源: https://bugs.webkit.org/show_bug.cgi?id=227199#c6 — 一手]

**根因 B：PannerNode / 持续更新参数类节点导致渐进式劣化**

- Bug 227199「Progressively worsening crackling / distortion」：iOS 14.6 上音频"像反馈回路一样"逐渐劈裂直至停止；简化用例仅需一个每帧更新 position/orientation 的 PannerNode；伴随 CPU 从 20% 涨到 99%。修复（Bug 230950）随 **iOS 15.2** 发布；但 Safari 15.2 又出现 ramped transform（`linearRampToValueAtTime`）15 秒内停播的后续 bug（Bug 234979）。另有用户报告：**简单 oscillator（p5.js）在 iPhone/iPad 上也爆音**、"noise can happen especially if CPU usage is high"。[来源: https://bugs.webkit.org/show_bug.cgi?id=227199 — 一手；关联 https://bugs.webkit.org/show_bug.cgi?id=230950 、 https://bugs.webkit.org/show_bug.cgi?id=234979]

**根因 C：硬件输出采样率动态切换（44.1kHz ↔ 48kHz）→ 失真/变速**

- Bug 154538「Web Audio becomes distorted after sample rate changes」：iOS 上硬件采样率随输出路由变化；AudioContext 创建时按 48k 配置、渲染时硬件切到 44.1k（或相反）→ "The WebAudio output is either distorted afterwards, or plays too fast (44.1 -> 48)… or not at all"。WebKit 工程师明确："**Web Audio developers can't assume that the output sample rate will always be 44.1kHz**… they could playback artifacts"，并怀疑 "Safari mistakes the output sample rate for 48 KHz when it's really 44.1 KHz, and accordingly **decodeAudioData is resampled to the wrong rate**"；还提到部分机型内放锁定 48kHz。关掉标签页重开可恢复。测试者实测：锁 48k 无失真、锁 44.1k 也无失真，**失真发生在动态切换**。[来源: https://bugs.webkit.org/show_bug.cgi?id=154538 — 一手（直连 503 时经搜索引擎自该 bug 页快照核对引文）]
- Bug 168165「Playing a HTML video element corrupts AudioContext」：页面里播放一个 `<video>` 后，已有 AudioContext 随机出现"失真 / 按 48/44.1 变速 / 完全停摆"；内放比耳机明显；"**All AudioContexts created after playing a video with low sample rate audio will inherit that same low sample rate… persists for the lifetime of the browser tab**"。[来源: https://bugs.webkit.org/show_bug.cgi?id=168165 — 一手，含 WebKit 工程师 Jer Noble 参与]

**根因 D：样本重采样错配（44.1k 资产在 48k context 播放）**

- Howler.js issue #1141：44.1kHz 资产在 48kHz context 播放出现 crackles/pops；"**playback on headphones does not have the crackling**"（内外放行为不同）；后续 48kHz 资产又触发 bitcrushing 式失真。评论区（儿童教育应用开发者）特别指出旧 iPad 上问题更多——"parents not buying the latest things for the kids"（与本项目"孩子的旧 iPad"场景高度吻合）。[来源: https://github.com/goldfire/howler.js/issues/1141 — 二手，开发者社区，但引用了上述 WebKit bug]
- 厂商知识库佐证：WavePlayer KB 指 Safari/iOS 13 起，文件采样率与当前设备不一致时 WebAudio 无法正确重采样导致失真。[来源: https://waveplayer.info/kb/the-audio-is-distorted-in-safari-and-ios/ — 二手，插件厂商 KB]

**根因 E（物理性，非 bug）：小扬声器重放不了低频，却为此付出 headroom**

- 见 A.4 行业实测：低于约 150–200Hz 的能量在 iPad 内放基本无法重放，却消耗位移与动态余量，并把其他声音挤爆。

**对"坦克引擎嗡鸣"的针对性结论（综合 A.1 与 A.4）**：52–98Hz 基频落在 iPad 内放几乎不重发的频段，但 sawtooth 的能量集中在基频——结果是**喇叭重放不出基频，却要为它付出位移/headroom 代价**；残存低次谐波经 260Hz lowpass 后音色寡淡，而持续低频能量持续触发 threshold -12 的压缩器 + makeup gain 反复推拉（A.1.2 机制），高频音效叠加时瞬时超 ±1（规范 §5.1 未定义行为）——这与"桌面端尚可、iPad 内放破音"的症状吻合。桌面扬声器能重放低频且动态余量大，故不明显。

### A.2 播放"录制好的音乐文件"的三条路线

**AudioBufferSourceNode（fetch → decodeAudioData → 整段 PCM 播放）**

- MDN：decodeAudioData 将文件**整段解码并重采样到 AudioContext 的采样率**；"This method only works on complete file data"；提供 Promise 与 legacy callback 两种形式。[来源: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData — MDN 引用规范]
- 循环无格式层接缝：规范 §1.9.5 规定 `loop=true` 时在 `loopStart`/`loopEnd` 区间**基于 PCM 数据回绕持续播放**，播放算法在 loopEnd 后从 loopStart 插值续播，不存在解码器重启。[来源: https://webaudio.github.io/web-audio-api/#looping-AudioBufferSourceNode — 一手]
- 代价：整段驻内存（长音乐 = 内存尖峰，iOS 上影响见 A.1 GC 压力）。

**HTMLAudioElement（`<audio>`）**

- 流式、省内存、天然获得锁屏/控制中心集成；但受自动播放政策约束（见 A.1.3 引 WebKit 博客：自 iPhoneOS 3 起需用户手势，iOS 10 放宽只覆盖静音视频）。[来源: https://webkit.org/blog/6784/new-video-policies-for-ios/ — 一手]
- `createMediaElementSource()` 接入 WebAudio 图在 iOS 有历史性噪声 bug：Bug 227199 评论 #11（Takahiro Aoyagi）："Audio which is made with WebAudio createMediaElementSource() can cause noise… iPhoneX iOS 14.8 Safari，iOS 15 修复"。[来源: https://bugs.webkit.org/show_bug.cgi?id=227199#c11 — 一手]
- `loop` 属性不保证无缝：MP3 等帧式编码的循环接缝是格式固有属性（见 A.2.3），`<audio>` 每圈还会像"文件式播放器"一样重启解码器。

**MediaSession API（锁屏/控制中心集成）**

- iOS 16.4 起可用：David Bushell 在 iOS 16.4 上实测 `navigator.mediaSession.metadata` / `setActionHandler` 可驱动锁屏控制（PWA 场景）。[来源: https://dbushell.com/2023/03/20/ios-pwa-media-session-api/ — 二手，资深 Web 开发者实测]
- web.dev 官方指南：Media Session 提供锁屏/通知区/硬件键控制，`setActionHandler` 不支持的动作会 throw，需 try/catch。[来源: https://web.dev/articles/media-session — Google 官方文档]

**后台/锁屏切换**

- MDN Web Audio best practices："Create or resume context from inside a user gesture"。[来源: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices — MDN]
- Apple 原生侧对应概念：AVAudioSession「Handling audio interruptions」——iOS 系统会打断音频（来电、Siri、其他 App 独占输出）；Web 侧对应物是 `AudioContext` 的 `"interrupted"` 状态与规范 §2.7「Handling an interruption on the AudioContext」。**页面切后台再回来、锁屏、来电后不恢复/爆音，属于打断路径问题**。[来源: https://developer.apple.com/documentation/avfaudio/handling-audio-interruptions — 一手； https://webaudio.github.io/web-audio-api/#interruption-handling — 一手]

**decodeAudioData 在 Safari 的已知怪癖**

- **Promise reject null**：Safari 在本应 reject `EncodingError` 的场合以 `null` reject Promise（iOS 14 报告，长期存在）。[来源: https://stackoverflow.com/questions/66450267/ — 二手高票；佐证 https://github.com/dart-lang/sdk/issues/47520 — 二手]
- **解码失败回归**：Safari 15.1 曾批量解码失败，15.4 修复。[来源: https://krpano.com/forum/wbb/index.php?thread/18591-safari-15-1-decoding-audio-data-failed/ — 二手]
- **重采样错配**：WebKit 工程师在 Bug 154538 中怀疑 decodeAudioData "is resampled to the wrong rate"。→ 实务：**用哪个 context 播放就用哪个 context 解码**。[来源: https://bugs.webkit.org/show_bug.cgi?id=154538 — 一手]

### A.3 采样率行为

- **`sampleRate` 构造选项**：`new AudioContext({sampleRate})` 自 **Safari 14.1 / iOS 14.5** 支持。[来源: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext（BCD）]
- **硬件采样率不固定、会动态切换**：Bug 154538 与 168165 一手结论（A.1 根因 C）：内放/耳机/蓝牙/视频播放可令硬件率在 44.1k↔48k 间切换；播过某低采样率视频后，**同 tab 后续新建的所有 AudioContext 继承该采样率**。→ 实务：**不缓存采样率假设、建图时读 `audioCtx.sampleRate`；页面中不要混用会改硬件率的媒体元素**。
- 规范建议浏览器默认率只在 44.1k 与 48k 二选一（系统择优）。[来源: https://webaudio.github.io/web-audio-api/#privacy-considerations — 一手]
- **对合成器代码的含义**：白噪 buffer 等以 `ctx.sampleRate` 生成/缓存（项目已做对）；若显式传 `sampleRate` 选项，与硬件不一致时 WebKit 需插入重采样链——在已知 bug 背景下，**更稳妥的是跟随硬件默认率**。

### A.4 移动端小扬声器混音的行业做法

- **小扬声器频响实测（行业一手测量）**：Audiokinetic（Wwise 中间件厂商）博客《Loudness and frequency response on popular smart phones》实测主流手机扬声器响度与频响。[来源: https://blog.audiokinetic.com/loudness-and-frequency-response-on-popular-smart-phones/ — 厂商实测（直连失败，经两处独立引用确认存在与结论）]
  - 游戏声音设计师 Oliver Smith 对该测量的总结与工作法："**Mobile speakers tend to drop off at around 800Hz**（做法上用 800/400/200Hz 三档 high-pass 模拟小喇叭做混音检查）"、4–5kHz 频段在小喇叭上特别突出易疲劳需克制、高频约 10kHz 起衰减、**多数手机扬声器近单声道，务必用 mono 检查混音**；低频损失用失真/饱和补 upper harmonics 而非硬推电平。[来源: https://www.oliversmithsound.com/blog/how-to-make-your-mobile-game-sound-better — 二手，从业声音设计师，明确引用 Audiokinetic 数据]
- **同时发声数与节点清理**：DynamicsCompressorNode 的游戏用途是"large numbers of individual sounds are played simultaneous to control the overall signal level and **help avoid clipping**"（规范 §1.19）；而 Bug 222098 证明**图里节点规模本身**就是爆音变量（约 2000 节点即劣化）→ 实务：voice 上限 + 最老声音抢占（voice stealing）+ 播完立即 `disconnect()`。[来源: https://webaudio.github.io/web-audio-api/#DynamicsCompressorNode 、 https://bugs.webkit.org/show_bug.cgi?id=222098 — 一手]
- **参数过渡**：规范 §7.3：直接 `param.value = x` 无自动平滑，需要平滑过渡时用 `setTargetAtTime()` 低 timeConstant——gain 爆/pop 常来自瞬时跳变。[来源: https://webaudio.github.io/web-audio-api/#audioparam-transitions — 一手]
- **加载与交互**：MDN best practices：短样本用 fetch+decodeAudioData、长曲目用媒体元素；手势内 create/resume context。[来源: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices — MDN]

### A.5 规范对 glitch 与 DynamicsCompressor 的定义（一手）

- **Audio Glitching（§7.4）**："Audio glitches are caused by an interruption of the normal continuous audio stream, resulting in loud clicks and pops. It is considered to be a **catastrophic failure**… can be caused by problems with the threads responsible for delivering the audio stream to the hardware, such as scheduling latencies… It can also be caused by the audio DSP trying to do more work than is possible in real-time given the CPU's speed." → **图太大 / 渲染线程被抢占 / CPU 算不过来 = 规范定义的 glitch 来源**，与 WebKit GC/图膨胀 bug 互相印证。[来源: https://webaudio.github.io/web-audio-api/#audio-glitching — 一手]
- **DynamicsCompressorNode（§1.19）**：
  - "Fixed look-ahead（**给信号链增加固定延迟**）"；有 tail-time（零输入后仍输出）。
  - **自动 makeup gain**："The makeup gain is a **fixed gain stage that only depends on ratio, knee and threshold**… not on the input signal."（取全范围补偿的 0.6 次幂）→ threshold -12 + ratio 12 的重压缩会稳定抬高低电平信号——**常驻引擎嗡鸣这类持续低电平源会被持续抬高**，压缩器随每次音效 attack/release 反复"呼吸"（pumping）。[来源: https://webaudio.github.io/web-audio-api/#computing-the-makeup-gain — 一手]
  - 默认值：threshold -24 / knee 30 / ratio 12 / attack 0.003 / release 0.25。项目当前 threshold -12 比规范默认激进一倍。[来源: 同上 §1.19.3]
- **目标节点信号范围（§5.1/§5.2）**："The range of all audio signals at a destination node of any audio graph is nominally [-1, 1]… **is undefined** by this specification." → 多路方波+噪声叠加再经压缩器 makeup 抬升后瞬时超 1，行为未定义，在 iOS 小喇叭上即破音。[来源: https://webaudio.github.io/web-audio-api/#audio-values-rendering — 一手]

### A.6 WebKit 官方博客要点（一手）

- Safari 14.1（iOS 14.5，2021-04）：Web Audio API 完成标准化合规、去前缀、支持 AudioWorklet——本项目可用的现代 API 基线。[来源: https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/]
- Safari 16.4（2023-03）："**Fixed only requiring a transient user activation for Web Audio rendering**"（Web Audio 渲染只需瞬态用户激活）；同版新增 "Support for a subset of the AudioSession Web API"。[来源: https://webkit.org/blog/13966/webkit-features-in-safari-16-4/]
- iOS 端 `<audio>/<video>` 自动播放政策的权威陈述：Jer Noble《New `<video>` Policies for iOS》："**Since before your sun burned hot in space… Safari on iOS has required a user gesture to play media in a `<video>` or `<audio>` element**"；user gesture "must have directly resulted from a handler for a touchend, click, doubleclick, or keydown event"。[来源: https://webkit.org/blog/6784/new-video-policies-for-ios/]

### A.7 格式支持与无缝循环（gapless loop）

**iPad Safari 支持的音频格式（一手数据）**

| 格式 | iPad Safari 支持情况 | 来源 |
|---|---|---|
| AAC (m4a/mp4) | 全面支持（iOS 原生格式，Core Audio 官方清单） | [Apple Core Audio Essentials — 一手] https://developer.apple.com/library/archive/documentation/MusicAudio/Conceptual/CoreAudioOverview/CoreAudioEssentials/CoreAudioEssentials.html |
| MP3 | 支持（Safari 3.1 起） | [MDN codec guide] https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs |
| WAV | 支持（iOS 原生格式表） | 同上 Apple 文档 — 一手 |
| FLAC | Safari 11 起 | 同 MDN |
| Opus | iOS 11 起仅 CAF 容器；Safari 17.0 加 WebM/MP4 容器 | MDN； https://webkit.org/blog/14445/webkit-features-in-safari-17-0/ — 一手 |
| OGG Vorbis | **.ogg 文件 iOS ≤17.3 不支持**；17.4–18.3 仅支持 Vorbis 编码但不支持 Ogg 容器（即 WebM 内）；**18.4 起才完整支持** | [caniuse 原始数据 notes_by_num #2 — 一手] https://raw.githubusercontent.com/Fyrd/caniuse/master/features-json/ogg-vorbis.json |

**MP3 循环接缝的经典问题（权威出处）**

- CompuPhase《Gapless looping MP3 tracks》（嵌入式音频公司应用笔记，附可复现工具）：MP3 "seems to insist on having silence at the start and the end of the track (**duration in the order of 10 ms to 50 ms**)"。机理：① MP3 帧固定 1152 样本，末帧补静音，许多编码器还追加整帧静音；② 编码器延迟（LAME 576 样本）；③ 解码器延迟（529 样本）；④ MDCT 重叠变换首帧依赖"上一帧"，循环点断链；⑤ bit reservoir 使帧依赖回溯 7–8 帧。**文件式播放器每圈重启解码器 → 约 12ms 静音缝**。[来源: https://www.compuphase.com/mp3/mp3loops.htm — 工程应用笔记]
- HydrogenAudio Knowledgebook "Gapless"：解码器必须主动按 LAME 头跳过 encoder delay/padding 才能无缝。[来源: http://wiki.hydrogenaudio.org/index.php?title=Gapless — 二手社区知识库]
- **推论（有规范背书）**：经 `decodeAudioData` 解码成 PCM 后用 `AudioBufferSourceNode.loop` 播放，绕开解码器重启，循环是**数据回绕**而非文件重播——这是 iOS 上做无缝循环的正确姿势。若坚持 `<audio loop>` 直连，MP3/AAC 等帧式编码都有 gap 风险。

### A.8 对本项目的落地启示（按"先除杂音、再谈音色"排序）

1. **给常驻引擎嗡鸣重新设计频段（首要嫌疑）**：基频上移到 120–250Hz、用轻微饱和/颤音补"体积感"，或先静音引擎音做 A/B 验证。
2. **重新审视 master DynamicsCompressor**：它带固定 look-ahead 延迟与 tail-time；threshold -12 + ratio 12 远激进于规范默认。优先靠 per-sound gain 排混音层级，压缩器退回"safety limiter"定位（更接近默认参数）。
3. **每次 BufferSource/振荡器播完显式清理**：`onended` 里 `disconnect()`（Bug 222098 官方 workaround）。
4. **采样率纪律**：所有 buffer 用 `ctx.sampleRate` 生成（已做对）；不缓存采样率假设；页面里避免同时播放 `<video>`。
5. **挂起/打断路径**：保持"挂起时不排队"；补充 `state === 'interrupted'` 的处理（来电/Siri/锁屏回来后 `resume()`）。
6. **录制好的 BGM**：m4a(AAC) → 用户手势内 `new AudioContext()` → `decodeAudioData`（可退回 callback 形式，Promise 可能 reject `null`）→ `AudioBufferSourceNode` + `loop=true` + `loopStart/loopEnd` 剪在零交叉。**不要用 MP3 做无缝循环**。需要锁屏控制再挂 MediaSession（iOS 16.4+）。
7. **移动端混音检查单**：主链挂 ~150–200Hz high-pass；同刻发声数设上限（≤6–8 路 + voice stealing）；按单声道混音；4–5kHz 段克制；所有 gain 变化走 `setTargetAtTime`。
8. **测试矩阵**：iPad 内放 vs 耳机分开测（多篇一手 bug 显示内外放行为不同）；连续玩 5–10 分钟再听（多个爆音 bug 是"渐进式"的）；有条件借一台旧 iPad。

---

## B. 音乐/音效素材来源与许可

### B.1 各站逐家核对（许可原文）

**Kenney.nl —— 唯一的音乐包是「Music Jingles」**

官网 Audio 分类全部音频包：Casino Audio、Sci-fi Sounds、Interface Sounds、Impact Sounds、Voiceover Pack (Fighter)、Voiceover Pack、**Music Jingles**、RPG Audio、Digital Audio、UI Audio；带 music 标签的只有 Music Jingles 一个。[来源: https://kenney.nl/assets/category:Audio 、 https://kenney.nl/assets/tag:music]

Music Jingles 包（85 个文件）页面标注 "License | **Creative Commons CC0**"。实际下载官方 zip（1.18 MB）解包验证：**86 个 .ogg 文件，共 1.37 MB**，单个 jingle 仅 8–39 KB（数秒短曲，非长背景乐）。包内 `License.txt` 原文：

> "License (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/
> **You may use these assets in personal and commercial projects. Credit (Kenney or www.kenney.nl) would be nice but is not mandatory.**"
> （可在个人与商业项目中使用；署名很好但不是强制的。）
> [来源: https://kenney.nl/assets/music-jingles 及包内 License.txt，解包核对]

注意：Kenney 全站音频**只提供 OGG 格式**（解包实证），iPad Safari 兼容问题见 A.7/B.4。

**OpenGameArt.org —— Minecraft/ambient 风格候选（曲目页逐一核对）**

OGA 的 "Minecraft" 社区精选集收录 10 首同风格曲目（入口值得收藏）：[来源: https://opengameart.org/content/minecraft]

| 曲目 | 作者 | 许可（页面标注） | 格式/体积 | 附注 |
|---|---|---|---|---|
| **Crickets – General calm ambient music** | SpringySpringo (2022) | **CC0 与 CC-BY 3.0 双许可**（可按 CC0 用） | mp3 8.5 MB + wav 36.9 MB（mp3 实测 8.11 MB） | 自述 "heavily reminiscent of c418's score of minecraft"，标 minecraft/calm/piano |
| **Ambience of a Fallen Age** | Umplix (2022) | **CC0** | 4 首 wav，单首 19.9–39 MB | 标 volcano/nether/ocean/minecraft，配洞穴/深海场景合适 |
| Broken Glimmers | Tsorthan Grove (2022) | CC-BY 4.0（需署名） | flac 25.5 MB | lo-fi/chill，慢起、全程低能量 |

关键原文摘录：

- Crickets 页："**Credit isn't required, but appreciated.**" [来源: https://opengameart.org/content/crickets-general-calm-ambient-music]
- Ambience of a Fallen Age 页："**You can credit me as Umplix if you want to give it. However, this is licensed CC0, so attribution/credit is not required.**" [来源: https://opengameart.org/content/ambience-of-a-fallen-age]

提醒：OGA 上也有 CC-BY-SA 曲目（如 manakade 的 Ambient music 四首，CC-BY-SA 3.0 [来源: https://opengameart.org/content/ambient-music]）。**SA 对改编有传染性**，本项目建议只挑 CC0 / CC-BY，避开 CC-BY-SA。

**FreePD.com —— 已永久关站（重要变化）**

官网现挂关站公告："After 17 years of sharing millions of free-to-use, Public Domain music downloads with creators worldwide, we have officially taken the service offline. … **[freepd.com] is now permanently closed.** 2008-2025" [来源: https://freepd.com/ （2026-10-23 实测访问）]。**不要再把 FreePD 列入候选**。

**Kevin MacLeod / incompetech.com —— CC-BY 4.0，署名要求原文**

官方 FAQ 确认约 2000 首曲子免费使用但**必须署名**，标准格式：

```
Title Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0
https://creativecommons.org/licenses/by/4.0/
```

针对游戏："**Video Games — Most commonly, credits are placed on a 'Credits' screen found in the settings menu.**"；免费下载仅 MP3（WAV 收费）；可剪辑改编但须在 credits 里区分"哪些是我的、哪些是你的"。[来源: https://incompetech.com/music/royalty-free/faq.html 、 https://incompetech.com/music/royalty-free/licenses/ 、 https://incompetech.com/llms.txt]

**Pixabay 音频 —— 自有 Content License，免署名、明确允许游戏内使用**

用的是自定义「Content License」而非 CC0。License Summary 允许项："✓ Use Content for free / ✓ **Use Content without having to attribute the author** / ✓ Modify or adapt Content into new works"；FAQ 明确允许 "**Incorporation into a greater work (e.g. adding it to a book, app, game).**"；禁止项核心一条：不得以 **Standalone basis**（与站上原样基本相同的独立形式）销售或分发内容。注意：部分上传者会注册 Content ID；条款提醒"内容可能含第三方权利，It's your responsibility to check"——**每首要人工听审**。下载格式 **MP3**。[来源: https://pixabay.com/service/license-summary/ 、 https://pixabay.com/service/faq/（403 拒绝机器人抓取，条款文本经搜索缓存与 Wikipedia 交叉核对）]

**C418 的 Minecraft 原声：版权状态（不可使用）**

- 维基百科「Music of Minecraft」（综合 The Guardian 2014 访谈等）："**Persson chose to commission the music from Rosenfeld, meaning the artist still retains ownership of all the music he made for Minecraft.** … All contributions … by artists other than Rosenfeld are owned by and have been released under Microsoft's own label." [来源: https://en.wikipedia.org/wiki/Music_of_Minecraft]
- Vice 访谈（一手）："**Because Rosenfeld owns all rights to the music, he is able to build upon the sounds of Minecraft's world as a solo artist.**" [来源: https://www.vice.com/en/article/minecrafts-composer-explains-why-the-music-is-so-weird]
- MusicBrainz 登记：Volume Alpha ©/℗ 2011 C418；Volume Beta ℗ 2013 C418。[来源: https://musicbrainz.org/release/5e396e48-5bc1-4d28-ab34-ee77dc534fed]

**结论：无论版权归 C418 还是 Microsoft/Mojang，两卷原声均为受版权保护的商业录音，未授予任何开放许可，打包进仓库即侵权。**（第三张专辑《Volume Final》正因版权/法务冲突至今未发行——旁证这套音乐的权利链条有多敏感。）

### B.2 风格参考：Minecraft 音乐设计（C418 极简 ambient、稀疏触发）

1. **稀疏触发、留白的情感效果**（Red Bull Music Academy Daily 专访，2015，最核心一段）："Then we had that music **randomly playing 15 to 20 minutes in**, where there's nothing else playing. If something significant is happening, the player remembers the music associated with it. … I was like, 'You should probably play the music **as few times as possible** because it's probably going to be annoying.' **And it turns out the pause in between actually helps. It has a very weird emotional effect.**" [来源: https://daily.redbullmusicacademy.com/2015/08/c418-interview/]
2. **不做"场景配乐"、表现孤独感**（FACT Magazine，2015）："**Minecraft specifically is just so random; you can't predict anything at all, ever.** … I can't make music that makes any sense to the environment. … I think the narrative I had in mind was **the kind of loneliness that the game exudes.**" [来源: https://www.factmag.com/2015/09/05/minecraft-c418-interview/]
3. **极简主义方法论**（Bandcamp Daily，2018）："**For Minecraft in fact, I tried to learn how little you actually need in order to have interesting sounds.**"；同期报道形容其曲目 "often little more than a few notes played in the purest tones—never distracting from the world of the game"。[来源: https://daily.bandcamp.com/features/c418-minecraft-excursions-interview]
4. **学术级佐证**：美国国会图书馆国家录音登记处 2025 年收编《Minecraft – Volume Alpha》，官方评注："**'Minecraft' is an outlier among open-world games in that its music occurs randomly and sporadically**, inconsistently connected with elements of the setting such as time and location." [来源: https://www.loc.gov/static/programs/national-recording-preservation-board/documents/Minecraft-Volume-Alpha_Grosser.pdf]
5. **实际触发机制**（Minecraft Wiki，可直接抄参数）："The regular, Creative, Nether, End, and underwater gameplay music **randomly plays 10 to 20 minutes** after currently playing tracks are finished."；菜单音乐 "a random menu track starts playing after **1 to 30 seconds**."。曲目时长：主世界曲多在 **1:05–8:34**，典型 3–5 分钟（Key 1:05、Sweden 3:35、Danny 4:14、Taswell 8:34）。[来源: https://minecraft.wiki/w/Music]

**设计翻译**：背景乐不连续循环——随机间隔（可缩到 1–3 分钟量级适配短训练局）淡入一首 3–5 分钟的极简钢琴/ambient，音量低于音效；菜单页延迟数秒~30 秒进曲。**稀疏一次性播放天然回避了无缝循环问题**。

### B.3 儿童游戏音频的特殊考虑（音量、突发响度）

**听力安全（WHO/ITU 官方数值）**

- WHO-ITU《安全收听设备全球标准》(2019)："**Mode 1 for adults: 80 dB for 40 hours per week. Mode 2 for children: 75 dB for 40 hours per week.**" [来源: https://www.who.int/publications/i/item/9789241515276]
- WHO 问答页：音量不超过设备最大音量的 **60%**、平均低于 80 dB；90 dB 时安全收听时间骤降到每周 4 小时 [来源: https://www.who.int/news-room/questions-and-answers/item/deafness-and-hearing-loss-safe-listening]
- ITU-T H.870 v2 (2022)：近耳玩具 "LpA … **shall not exceed 80 dB** when measured in a free field." [来源: https://www.itu.int/epublications/zh/publication/itu-t-h-870-v2-2022-03-guidelines-for-safe-listening-devices-systems/en]

**响度标准（广播 vs 游戏行业实际做法）**

- 测量算法：ITU-R BS.1770-5（2023 现行版），定义 LKFS（≡LUFS）与 dBTP 真峰值 [来源: https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en]
- 广播参照：EBU R128 —— 目标 **−23.0 LUFS**、真峰值 **≤ −1 dBTP** [来源: https://tech.ebu.ch/docs/r/r128v4_0.pdf]
- **游戏主机厂实际要求（最接近本需求）**：索尼 PlayStation ASWG-R001 v1.2（2024-03）："the Average Loudness Level of audio content within a title developed for **home-based SIE platforms should be normalized to a Target Level of −24 (±2) LKFS**" / "**portable SIE platforms … −18 (±2) LKFS**"；测量须用 BS.1770-5 工具、最少 30 分钟、覆盖代表性玩法片段。[来源: https://github.com/Sony-ASWG/Loudness]
- 游戏音频中间件共识（Audiokinetic/Wwise 官方博客）：30 分钟整体响度对游戏不完全适用——"we care more about **short-term loudness, a game's runtime average loudness, and max short-term loudness (during a 400–3,000 ms time frame)**." [来源: https://www.audiokinetic.com/en/blog/loudness-processing-best-practices-series-chapter1-loudness-measurement-part1]

**落地建议**（基于上述标准的综合推断）：整体混音参考 **−24 ~ −18 LUFS**（儿童向再保守），音频文件真峰值 **≤ −1 dBTP**；每个音效播放加 5–20 ms 线性淡入（音乐 0.5–1 s），BusGain 变化做 ramp；避免"吓一跳"式 jump scare 音效（爆炸起音偏软）；默认主增益保守（呼应 WHO "60% 音量"），并提供 音乐/音效/总音量 控制。

### B.4 格式转换与体积预算

**各站实际提供格式（多数实物验证）**：Kenney 仅 OGG（解包实证）；OGA 因上传者而异（mp3/ogg/wav/flac 混杂）；incompetech MP3 免费/WAV 收费；Pixabay MP3；FreePD 已关站。

**iPad Safari：必须转 AAC/m4a（或 MP3），OGG 不可靠**——桌面 Safari 也要 18.4 才完整支持 OGG（A.7 一手数据）。孩子的设备系统版本不可控（大量 iPad 停在 iOS 15–17）→ **主格式选 AAC(.m4a)**：所有目标浏览器原生解码、同码率音质优于 MP3、iOS 有硬件解码。求省事也可单用 MP3（全平台通吃，体积略大）。

**体积速查（每轨）**：AAC 128k ≈ 0.96 MB/分钟；AAC 96k（ambient 足够）≈ 0.72 MB/分钟；AAC 64k（极简钢琴可试）≈ 0.48 MB/分钟。实测数据点：Kenney Music Jingles 全包 1.37 MB/86 首；OGA Crickets mp3 320k 为 8.11 MB/3:34。

**体积预算建议**：背景乐 5–6 首 × 3–4 分钟 AAC 96–128k ≈ 12–20 MB；音效全量 ≈ 1–2 MB；合计 **~15–25 MB**，本地 git 仓库可承受。只做单格式 m4a（双格式翻倍不值）。超大 wav/flac 源文件**不要**提交进仓库。

**解码内存（补充推算）**：decodeAudioData 后 PCM 占用 = 时长 × 采样率 × 声道 × 4 字节，与源码率无关。3:34 立体声 44.1k ≈ 75 MB；**转单声道减半 ≈ 38 MB**，且 iPad 扬声器近单声道（A.4），BGM 用 mono 源是内存与听感的双优解；短 jingle 无此顾虑。

### B.5 推荐清单（可直接下载使用的候选）

| # | 候选 | 风格 | 许可 | 格式（原始 → 建议） | 预计入库体积 |
|---|---|---|---|---|---|
| 1 | **Kenney「Music Jingles」**（85 首五组：8-Bit/Hit/Pizzicato/Sax/Steel）[https://kenney.nl/assets/music-jingles] | 短 jingle：成功/失败/HIT 提示，正对"训练反馈音" | **CC0**（包内 License.txt 实证，免署名） | OGG → 转 AAC | **~1.4 MB** 全包 |
| 2 | **OGA「Crickets」** by SpringySpringo [https://opengameart.org/content/crickets-general-calm-ambient-music] | C418 式安静钢琴 ambient | **CC0**（双许可选 CC0，免署名） | mp3 320k → AAC 96–128k | ~2.5–3.4 MB |
| 3 | **OGA「Ambience of a Fallen Age」** by Umplix（4 首）[https://opengameart.org/content/ambience-of-a-fallen-age] | 洞穴/熔岩/深海 dark ambient（配地下/水下场景） | **CC0**（免署名） | wav → AAC | 挑 2–3 首 ≈ 6–10 MB |
| 4 | **OGA「Minecraft」社区精选集**（10 首入口页）[https://opengameart.org/content/minecraft] | 同风格合辑，供扩充曲库 | 逐曲核对（多为 CC0/CC-BY） | 混杂 → 统一转 AAC | ≈ 2–4 MB/首 |
| 5 | **Kevin MacLeod / incompetech**（ambient 分类，约 2000 首）[https://incompetech.com/music/royalty-free/music.html] | 专业制作、风格稳定，"第二梯队" | **CC-BY 4.0**：需 Credits 页按官方模板署名 | MP3 → 可直接用或转 AAC | ~2.5–4 MB/首 |

（备选：Pixabay [https://pixabay.com/music/] —— 免署名、明确允许游戏用、MP3 直下；但质量参差且需逐首人工审，不作首选。）

**推荐组合预算**：1 + 2 + 3 全取 + 4 挑两首 ≈ **18–25 MB、8 首左右背景乐 + 全套反馈音效**，全部 CC0、零署名负担、单一 m4a 格式。

**配套工程约定**：仓库建 `assets/audio/`（只放转码后 m4a）+ `assets/audio/CREDITS.md`（即便全 CC0 也记录曲目名/作者/来源 URL/许可链接/下载日期）；源 wav/flac 不入库；播放走 WebAudio decodeAudioData（AAC 全平台支持）；BGM 触发按 B.2 抄"随机间隔 + 淡入淡出"模型；响度/突响约束按 B.3。

---

## 附：关键一手来源索引

| 主题 | URL |
|---|---|
| Web Audio API 规范（glitch/compressor/looping/sampleRate/interruption） | https://webaudio.github.io/web-audio-api/ |
| Bug 222098 BufferSource 爆音/图膨胀 | https://bugs.webkit.org/show_bug.cgi?id=222098 |
| Bug 227199 渐进式失真 | https://bugs.webkit.org/show_bug.cgi?id=227199 |
| Bug 154538 采样率切换失真 | https://bugs.webkit.org/show_bug.cgi?id=154538 |
| Bug 168165 video 污染 AudioContext | https://bugs.webkit.org/show_bug.cgi?id=168165 |
| WebKit 博客：Safari 14.1 / 16.4 / iOS 媒体政策 | https://webkit.org/blog/11648/ 、 https://webkit.org/blog/13966/ 、 https://webkit.org/blog/6784/ |
| Apple：iOS 音频格式 / 打断处理 | https://developer.apple.com/library/archive/documentation/MusicAudio/Conceptual/CoreAudioOverview/CoreAudioEssentials/CoreAudioEssentials.html 、 https://developer.apple.com/documentation/avfaudio/handling-audio-interruptions |
| caniuse 原始数据：ogg-vorbis | https://raw.githubusercontent.com/Fyrd/caniuse/master/features-json/ogg-vorbis.json |
| MDN：decodeAudioData / AudioContext / codec guide / best practices | https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData 等 |
| CompuPhase：MP3 无缝循环机理 | https://www.compuphase.com/mp3/mp3loops.htm |
| Audiokinetic：智能手机频响实测 | https://blog.audiokinetic.com/loudness-and-frequency-response-on-popular-smart-phones/ |
| Kenney / OGA / incompetech / Pixabay 许可页 | 见 B.1 各条 |
| C418 访谈 ×3 + 国会图书馆评注 + Minecraft Wiki 触发参数 | 见 B.2 各条 |
| WHO-ITU 儿童安全收听 / ITU-R BS.1770-5 / EBU R128 / Sony ASWG-R001 | 见 B.3 各条 |
