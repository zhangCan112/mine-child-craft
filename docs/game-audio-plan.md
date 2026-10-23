# 游戏音频系统重建方案（plan）

> 依据：`docs/game-audio-research.md`（2026-10-23，WebKit Bugzilla / W3C 规范 / 许可原文等一手来源逐条可溯）。
> 现状：全部音频在 `js/effects.js` —— WebAudio 合成音效 16 种（振荡器+滤波白噪）+ 常驻锯齿引擎嗡鸣，**无背景音乐**；iPad 内放杂音严重。
> 本文档只定方案；动工前不改任何代码。

## 0. 一页速览

| 项 | 结论 |
|---|---|
| 杂音根因 | 主嫌疑按序：引擎嗡鸣频段（<150Hz 喇叭发不出白耗 headroom）→ 压限器过激（threshold -12 + 规范 makeup gain 机制）→ 节点播完不 disconnect（WebKit Bug 222098 图膨胀）→ 无同时发声上限 |
| 修复策略 | P0 四处微修补先除噪 → P1 架构重排（sfx 接口不变，60+ 调用点零改动）→ P2 录制素材替换合成 + 稀疏 BGM → P3 打磨 |
| 素材 | Kenney Music Jingles（CC0 全包 1.4MB）+ OpenGameArt CC0 ambient 曲 4~6 首；**统一转 mono AAC/m4a**（iPad Safari ≤17.3 不支持 OGG）；总体积预算 ~15–25MB |
| BGM 模型 | 抄 Minecraft：**稀疏一次性播放**（随机间隔淡入，不循环）——回避无缝循环接缝、省内存、有 C418 一手访谈与 wiki 触发参数背书 |
| 新文件 | `js/audio-registry.js`（清单权威）· `js/audio-core.js`（纯决策核心）· `js/audio.js`（WebAudio adapter）· `assets/audio/`（素材 + CREDITS.md） |
| 降级链 | http 主路径（fetch+decodeAudioData 播样本）→ 解码失败 / file:// 自动回退现有合成引擎，游戏永不哑 |

## 1. 问题诊断（现状 → 根因映射）

| # | 症状/隐患 | 根因（研究出处） |
|---|---|---|
| D1 | iPad 内放持续"嗡嗡失真"，桌面端尚可 | engineHum 基频 52~98Hz 低于小扬声器可重放频段（~150–200Hz 以下实测发不出），锯齿能量集中在基频=纯耗 headroom；持续低电平还反复触发压限器 attack/release"呼吸"（A.4 频响实测 + A.1.2 makeup gain 机制） |
| D2 | 音效叠加时破音 | master 压限器 threshold -12 比规范默认激进一倍，makeup gain（只取决于 threshold/knee/ratio）稳定抬高一切低电平信号；多路方波+噪声叠加瞬时超 ±1，规范定义为未定义行为（A.5） |
| D3 | 长局（竞技场 100v100）越玩越劈 | 所有 BufferSource/振荡器播完**从不 disconnect**——WebKit 依赖 GC 回收，图膨胀到 ~2000 节点即劣化，官方 workaround 就是手动移除（Bug 222098，A.1 根因 A） |
| D4 | 大规模混战瞬间爆音 | 无同时发声上限：仅同类 60ms 节流，竞技场支持每队 100 只，hit/shoot/boom 多类并发叠加；方波/锯齿的 4–5kHz 谐波在小喇叭上又特别突出易疲劳（A.4） |
| D5 | 环境类（偶发） | iOS 硬件采样率动态切换失真、页面播 video 污染 AudioContext（Bug 154538/168165，A.1 根因 C）；本页无 video，风险低，但缺 `interrupted` 状态恢复处理（A.2） |
| D6 | 功能缺失 | 无 BGM、无音量控制、TTS 语音（SpeechKit 不经过 WebAudio 图）与音效/音乐互相抢 |

## 2. 目标与成功标准

1. iPad 内放连续游玩 10 分钟（含 100v100 竞技场浸泡）无杂音/破音/渐进式劣化；
2. 音效全部由专业录制的 CC0 素材发声（合成引擎降级为兜底路径）；
3. BGM 按 Minecraft 稀疏模型随机触发，模式间换曲有淡入淡出，TTS 说话时音乐自动让路；
4. `sfx(kind)` / `engineHum(level)` 接口签名不变——60+ 处调用点零改动；
5. 响度对儿童保守（整体 −24~−18 LUFS 区间下沿，真峰值 ≤ −1 dBTP，无"吓一跳"起音）；
6. `npm test` + `npm run lint` 全绿，boot 冒烟覆盖新文件。

## 3. 架构设计

### 3.1 文件布局（新增 ● / 改动 ○）

| 文件 | 动作 | 职责 |
|---|---|---|
| `js/audio-registry.js` | ● | 声音清单唯一权威（纯数据+纯函数，Node 可加载）：SFX_KINDS（kind → {file?, synth?, g, gTouch, prio, coolMs}）、MUSIC_TRACKS（trackId → {file, mood, g}）、MOODS（modeId → mood）；一条音效标 `file` 或 `synth` 决定走样本还是合成 |
| `js/audio-core.js` | ● | 纯决策核心（零 THREE·零 DOM，必有同名单测）：VoiceGate（限数/优先级抢占/同类冷却的准入决策）、MusicDirector（稀疏调度状态机：tick(dt) → start/stop/volume 事件）、混音响度常数表 |
| `js/audio.js` | ● | WebAudio adapter（引擎层）：AudioContext 生命周期（unlockAudio 迁入+补 `interrupted` 恢复）、总线图、素材加载与缓存、样本播放器（onended disconnect）、合成回退解释器（现 SFX_DEFS 逻辑迁入）、engineHum 重设计、MusicDirector 执行器 |
| `assets/audio/` | ● | 转码后 m4a + `CREDITS.md`（曲目/作者/来源 URL/许可/下载日期逐条溯源，全 CC0 也记） |
| `js/effects.js` | ○ | 瘦身为 Fx（视觉特效）+ toast；sfx/engineHum/unlockAudio 迁去 audio.js |
| `js/speech.js` | ○ | mkSpeech 加可选 duck 钩子（说话起止回调），audio 侧注入让音乐避让（应用层依赖引擎层，方向合法） |
| `js/mode-registry.js` | ○ | 每行加可选 `mood` 字段（数据级扩展，三重命名断言不受影响） |
| `js/main.js` | ○ | switchMode 里一行 `Audio.setMood(...)`；`interrupted`/visibilitychange 恢复挂钩 |
| `server.js` | ○ | MIME 补 `.m4a/.mp3/.ogg/.wav/.flac`；`assets/audio/` 豁免 no-store 走 ETag/304（省每次刷新 20MB 局域网传输；代码文件维持 no-store 不变）；音频不 gzip |
| `index.html` | ○ | script 列表在 effects.js 前插三个新文件；版本号行照例更新 |
| `docs/conventions.md` §1.1 + GLOSSARY.md + `docs/adr/0003` | ○ | 目录宪法加 assets/；新词条（AudioRegistry/AudioCore/MusicDirector）；"音频资产入库 + 单格式 m4a + 只取 CC0"写 ADR |

### 3.2 音频图

```
SFX voices (同时 ≤8 触屏 / ≤12 桌面, 优先级抢占最老)
  → sfxBus Gain ─ [IS_TOUCH: BiquadFilter highpass ~160Hz] ─┐
music voice (同时 ≤1, 一次性稀疏播放, 播完释放 PCM)          ├→ master Gain(0.8)
  → musicBus Gain(0.30 桌面 / 0.25 触屏; duck 时 0.08) ─────┘     → DynamicsCompressor
                                                                    (thr -18 / knee 24 / ratio 8, 保险丝定位)
                                                                    → destination
```

- 所有 Gain 变化一律 `setTargetAtTime`（规范 §7.3：瞬时赋值是爆/pop 来源）；
- 每个一次性 source 挂 `onended → disconnect()`（Bug 222098 官方 workaround）；
- 触屏 sfx 总线高通是 D1/D4 的图级保险：喇叭发不出的低频直接滤掉，给可听频段腾 headroom。

### 3.3 BGM 调度模型（MusicDirector，纯状态机可单测）

参数照 Minecraft Wiki 抄再按儿童短局缩放：

| 场景 | 行为 |
|---|---|
| 主菜单 | 手势解锁后随机 5–30s 淡入一首（wiki：菜单 1–30s） |
| 游玩中 | 一曲播完 → 随机 60–180s 静默 → 淡入下一首（wiki 原版 10–20min，儿童局 2–3 分钟故缩放）；同 mood 曲库 shuffle 不重复 |
| 切模式 | 1.2s 交叉淡出 → 新 mood 随机 15–45s 后起曲（同 mood 则续播不打断） |
| 专注训练营 | mood='none' 完全无 BGM（注意力训练哲学：配乐与反馈音争注意力；MISSION 反馈哲学零压迫） |
| TTS 说话 | musicBus duck 至 0.08（ramp 0.25s），说完 0.8s 缓升回 |
| 挂起/interrupted | 不排队不计时，恢复后续跑（沿用现有"挂起不排队"纪律） |

稀疏一次性播放三个工程红利：**不需要无缝循环**（MP3/AAC 帧式编码的 loop 缝问题整个消失）、**同时最多解码一首**（mono 3.5 分钟 ≈ 38MB PCM，播完丢引用回收）、**留白本身是 C418 验证过的情感设计**。

### 3.4 SFX 替换映射（注册表逐条标 sample/synth）

| 类别 | kind | 策略 |
|---|---|---|
| 反馈/仪式 | win, level, pick, click | Kenney Music Jingles + Interface/UI Audio 包挑样本（CC0） |
| 打击/爆炸 | boom, hit, hurt, shoot, death | Kenney Impact Sounds / RPG Audio 挑样本；选起音偏软的版本（儿童突响防护） |
| 持续/氛围 | fss（引线嘶声）, breath, roar, door, splash, zap | 样本挑不到合适的保留 `synth`（混合策略合法，注册表标注即档） |
| 载具 | engineHum | 合成重设计：基频上移 120–250Hz + bandpass + 轻微 AM 颤动补体积感（低于喇叭重放限的频段不再硬推）；保留 IS_TOUCH 增益减半；iPad A/B 验证后再考虑样本化 |

播放器统一给每个样本加 5ms 线性淡入（防点击噪）；响度以 per-sound gain 排层级（注册表 `g`/`gTouch` 两档），压限器只做保险丝（D2 对策）。

### 3.5 降级链（游戏永不哑）

```
http 主路径: 手势解锁 AudioContext → 懒加载 fetch(m4a) → decodeAudioData → 样本播放
   ↓ 失败任一环（旧 iPad 解码失败 / Promise reject null / file:// 无 fetch）
回退: 现有合成解释器（SFX_DEFS 全量保留为兜底路径, 注册表 synth 字段兜底样本缺失）
```

decodeAudioData 用 callback 形式包 Promise（Safari reject `null` 怪癖防护，A.2）；用哪个 context 播就用哪个 context 解码。

## 4. 素材方案

- **曲目**：OGA「Crickets」（C418 式钢琴 ambient，CC0）+「Ambience of a Fallen Age」挑 2–3 首（洞穴/熔岩配下界，CC0）+ Minecraft 精选集挑 1–2 首（逐曲核对许可）；mood 分组：`calm`（建造/主菜单）、`battle`（竞技场/坦克）、`dark`（下界）、`menu`。
- **反馈音**：Kenney Music Jingles 全包 + Interface Sounds 挑选（全 CC0）。
- **转码管线**（一次性手工，命令记入 CREDITS.md）：`ffmpeg -i src -ac 1 -c:a aac -b:a 96k -ar 44100 out.m4a`；BGM mono 96k、jingle mono 128k；响度 `loudnorm` 归一到目标区间；源 wav/flac 不入库。
- **红线**：不下载/不打包 C418 或 Minecraft 官方原声（受版权保护，B.1）；不取 CC-BY-SA（传染性）；CC-BY 只作第二梯队且必须做 Credits 署名页。
- **体积**：全 CC0 组合 ≈ 18–25MB。

## 5. 分阶段实施

| 阶段 | 内容 | 交付物/验收 |
|---|---|---|
| **P0 除噪微修**（半天，只动 effects.js 现有代码） | ① 全部 source 播完 `onended` disconnect；② IS_TOUCH 主链加 160Hz highpass；③ 压限器回调到保险丝参数（thr -18/knee 24/ratio 8）+ master 0.9→0.8；④ engineHum 频段重设计（120–250Hz） | iPad 内放+耳机各浸泡 10 分钟 100v100 无杂音 → 顺带定位 D1~D4 各自权重，给 P2 验收留基线 |
| **P1 架构重排**（不引素材） | 三新文件落地；sfx/engineHum/unlockAudio 迁入 audio.js（接口签名不变）；VoiceGate 上线；tests：audio-core（准入/抢占/冷却、MusicDirector 状态机）+ audio-registry（资产存在性、js/ 内 sfx 字面量 ⊆ 注册表键）+ boot 冒烟自动覆盖 | 全测试 lint 绿；听感与 P0 一致（合成照旧发声，只是走新总线） |
| **P2 素材 + BGM** | 下载/转码/入库 + CREDITS.md；注册表接样本；MusicDirector + mood 上线；speech duck 钩子；音量控制 UI（主菜单 音乐/音效 两滑杆，localStorage 记忆，默认保守值）；server MIME + 音频 ETag 缓存 | iPad 实机验收：BGM 稀疏触发正常、TTS 让路、切模式淡入淡出、旧曲库回归无杂音 |
| **P3 打磨收尾** | MediaSession 元数据（iOS 16.4+，可选）；素材响度统一过一遍 loudnorm；GLOSSARY/conventions/ADR-0003 文档三件套；设备矩阵（内放/耳机 × 10min × 旧 iPad） | AGENTS.md"收尾前必跑"三项全绿；文档过审 |

## 6. 测试与规范影响

- `-registry`/`-core` 后缀语义自动带上同名单测义务（conventions §1.2，守门测试会强制）；
- audio-registry 断言思路：清单里的文件 `fs.existsSync`（手滑路径即红）+ 扫 `js/**` 的 `sfx('…')` 字面量全在注册表（漏登记即红）+ CREDITS.md 覆盖每个资产文件名；
- 目录宪法新增 `assets/` 一行 + ADR 记"音频入库"不可逆决策（体积、许可纪律、单格式）；
- GLOSSARY 收词：AudioRegistry、AudioCore（VoiceGate/MusicDirector）、_Avoid_: effects.js 里的音效段（历史归属）。

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| 旧 iPad decodeAudioData 失败 / reject null | callback 包装 + 合成回退链（3.5） |
| file:// 直开无 fetch | 合成回退链（MISSION 的降级路径承诺不破） |
| BGM PCM 内存尖峰 | mono 源 + 同时 ≤1 首解码 + 播完丢引用；jingle 全长 <10s 无此虑 |
| 60+ 调用点回归 | sfx 接口签名零变化；boot 冒烟 + 注册表静态断言双保险 |
| 许可风险 | 只取 CC0；CREDITS 逐条溯源；不碰 Minecraft 原声与 CC-BY-SA |
| 采样率环境 bug（154538/168165） | 跟随硬件率不显式指定；页面不引入 video；`interrupted` 恢复处理 |
| 素材风格不合孩子口味 | P2 先小批量（每 mood 1 首）试听验收再扩库 |

## 8. 待拍板决策点

1. **P0 是否先单独做**（推荐：是——半天除噪，立刻改善 iPad 体验，且为后续验收留对照基线）；
2. **BGM 稀疏 vs 连续循环**（推荐：稀疏——一手证据 + 工程红利；若你更想要"一直有音乐"，改循环模型需额外做 loop 点修剪，成本与风险都更高）；
3. **音量控制入口**（推荐：主菜单角落 🎵 按钮展开两个大滑杆——触屏儿童友好；也可先不做，P3 再补）；
4. **专注训练营是否绝对无声环境**（推荐：无 BGM 但保留反馈音；若想要"白噪音式"环境垫，加一条 ≤−35 LUFS 的 ambient 循环亦可）。
