# assets/audio 素材溯源清单 (CREDITS)

> 红线：本目录全部素材均为 **CC0**（公有领域贡献），无一例外；不含
> Minecraft / C418 原声任何内容。注册表（js/audio-registry.js）引用的
> 每个样本/曲目文件都必须在本文件记载 —— test/audio-registry.test.js
> 的 CREDITS 覆盖断言逐条咬合（文件在而记录缺即红）。

## 公共信息（各节通用）

- 下载日期：Kenney 批次 **2026-10-23** · BGM 换曲批次 **2026-10-27**（PowerShell `Invoke-WebRequest` / `curl.exe`，源 zip/wav/flac/ogg 原件存仓库外临时目录，不入库）
- 许可：[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)（作者放弃一切权利，可商用、可改编、署名非义务——为溯源与儿童项目礼节仍逐条记录）
- 转码：ffmpeg 6.1.1（devDependency `ffmpeg-static` 附带构建；本机 PATH 无 ffmpeg，直连 GitHub 拉取其二进制时证书校验失败，需 `NODE_TLS_REJECT_UNAUTHORIZED=0`，详见工单 A7 / ADR 0003）
- 转码命令（128k 反馈短曲 / 打击样本，含响度归一）：

  ```
  ffmpeg -i <源> -af loudnorm=I=-21:TP=-2:LRA=7 -ac 1 -ar 44100 -c:a aac -b:a 128k <out>.m4a
  ```

  转码命令（96k BGM 长曲，含响度归一）：

  ```
  ffmpeg -i <源> -af loudnorm=I=-21:TP=-2:LRA=7 -ac 1 -ar 44100 -c:a aac -b:a 96k <out>.m4a
  ```

  统一 mono 44.1kHz AAC + 单遍 loudnorm 响度归一（I=-21 / TP=-2 / LRA=7，儿童保守目标，参数依据见 ADR 0003）。2026-10-23 批次的 13 个文件（3 BGM + 10 SFX 样本）按上述命令重转码归一；85 首 jingles 备用池未接线，**未做 loudnorm**——接线时须按上表命令补齐。

- 转码命令（2026-10-27 BGM 换曲批次 8 首；先单声道化 + 首尾静音修剪 + 双遍 loudnorm）：

  ```
  rem ① 测量遍: mono 化与静音修剪后测响度(print_format=json 取 input_i/input_tp/input_lra/input_thresh/target_offset)
  ffmpeg -i <源> -af "aformat=channel_layouts=mono,silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB,areverse,loudnorm=I=-21:TP=-2:LRA=7:print_format=json" -f null NUL
  rem ② 校正遍: measured_* 填①的读数, linear=true 线性增益(不压动态)
  ffmpeg -i <源> -af "aformat=channel_layouts=mono,silenceremove=…,areverse,silenceremove=…,areverse,loudnorm=I=-21:TP=-2:LRA=7:measured_I=…:measured_TP=…:measured_LRA=…:measured_thresh=…:offset=…:linear=true" -ac 1 -ar 44100 -c:a aac -b:a 96k -map_metadata -1 <out>.m4a
  ```

  与旧口径的两处差异（换曲批次实测教训）：**立体声 downmix 会拉低整体响度 ~2 LUFS**——先 `aformat=channel_layouts=mono` 再测再校，成品才落在 -21.0±0.1 LUFS（先按立体声测、输出时才 `-ac 1` 实际落在 ~-22~-23）；**loudnorm 改双遍**（先测后校 linear=true），单遍动态归一的结果随内容浮动。另加首尾静音修剪（-45dB 阈值），杜绝「起曲先是长空白 / 曲尾拖长静音」。已接线的 18 个文件（8 BGM + 10 SFX 样本）全部过 loudnorm 归一。

## 1. Kenney「Music Jingles」全包 85 首（反馈类短曲）

- 作者：Kenney Vleugels（[kenney.nl](https://kenney.nl)）
- 来源：<https://kenney.nl/assets/music-jingles>（zip 直链 <https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip>）
- 包内 `Preview.ogg` 为页面预览拼贴，非正式素材，不入库；85 首均按 128k 命令转码，下划线原名连字符小写化（`jingles_HIT00` → `jingles-hit00.m4a`）。本目录为其完整备用池，注册表暂未逐首引用。

| 文件 | 原名 | 组 |
| --- | --- | --- |
| jingles-hit00.m4a | jingles_HIT00 | Hit jingles |
| jingles-hit01.m4a | jingles_HIT01 | Hit jingles |
| jingles-hit02.m4a | jingles_HIT02 | Hit jingles |
| jingles-hit03.m4a | jingles_HIT03 | Hit jingles |
| jingles-hit04.m4a | jingles_HIT04 | Hit jingles |
| jingles-hit05.m4a | jingles_HIT05 | Hit jingles |
| jingles-hit06.m4a | jingles_HIT06 | Hit jingles |
| jingles-hit07.m4a | jingles_HIT07 | Hit jingles |
| jingles-hit08.m4a | jingles_HIT08 | Hit jingles |
| jingles-hit09.m4a | jingles_HIT09 | Hit jingles |
| jingles-hit10.m4a | jingles_HIT10 | Hit jingles |
| jingles-hit11.m4a | jingles_HIT11 | Hit jingles |
| jingles-hit12.m4a | jingles_HIT12 | Hit jingles |
| jingles-hit13.m4a | jingles_HIT13 | Hit jingles |
| jingles-hit14.m4a | jingles_HIT14 | Hit jingles |
| jingles-hit15.m4a | jingles_HIT15 | Hit jingles |
| jingles-hit16.m4a | jingles_HIT16 | Hit jingles |
| jingles-nes00.m4a | jingles_NES00 | 8-Bit jingles |
| jingles-nes01.m4a | jingles_NES01 | 8-Bit jingles |
| jingles-nes02.m4a | jingles_NES02 | 8-Bit jingles |
| jingles-nes03.m4a | jingles_NES03 | 8-Bit jingles |
| jingles-nes04.m4a | jingles_NES04 | 8-Bit jingles |
| jingles-nes05.m4a | jingles_NES05 | 8-Bit jingles |
| jingles-nes06.m4a | jingles_NES06 | 8-Bit jingles |
| jingles-nes07.m4a | jingles_NES07 | 8-Bit jingles |
| jingles-nes08.m4a | jingles_NES08 | 8-Bit jingles |
| jingles-nes09.m4a | jingles_NES09 | 8-Bit jingles |
| jingles-nes10.m4a | jingles_NES10 | 8-Bit jingles |
| jingles-nes11.m4a | jingles_NES11 | 8-Bit jingles |
| jingles-nes12.m4a | jingles_NES12 | 8-Bit jingles |
| jingles-nes13.m4a | jingles_NES13 | 8-Bit jingles |
| jingles-nes14.m4a | jingles_NES14 | 8-Bit jingles |
| jingles-nes15.m4a | jingles_NES15 | 8-Bit jingles |
| jingles-nes16.m4a | jingles_NES16 | 8-Bit jingles |
| jingles-pizzi00.m4a | jingles_PIZZI00 | Pizzicato jingles |
| jingles-pizzi01.m4a | jingles_PIZZI01 | Pizzicato jingles |
| jingles-pizzi02.m4a | jingles_PIZZI02 | Pizzicato jingles |
| jingles-pizzi03.m4a | jingles_PIZZI03 | Pizzicato jingles |
| jingles-pizzi04.m4a | jingles_PIZZI04 | Pizzicato jingles |
| jingles-pizzi05.m4a | jingles_PIZZI05 | Pizzicato jingles |
| jingles-pizzi06.m4a | jingles_PIZZI06 | Pizzicato jingles |
| jingles-pizzi07.m4a | jingles_PIZZI07 | Pizzicato jingles |
| jingles-pizzi08.m4a | jingles_PIZZI08 | Pizzicato jingles |
| jingles-pizzi09.m4a | jingles_PIZZI09 | Pizzicato jingles |
| jingles-pizzi10.m4a | jingles_PIZZI10 | Pizzicato jingles |
| jingles-pizzi11.m4a | jingles_PIZZI11 | Pizzicato jingles |
| jingles-pizzi12.m4a | jingles_PIZZI12 | Pizzicato jingles |
| jingles-pizzi13.m4a | jingles_PIZZI13 | Pizzicato jingles |
| jingles-pizzi14.m4a | jingles_PIZZI14 | Pizzicato jingles |
| jingles-pizzi15.m4a | jingles_PIZZI15 | Pizzicato jingles |
| jingles-pizzi16.m4a | jingles_PIZZI16 | Pizzicato jingles |
| jingles-sax00.m4a | jingles_SAX00 | Sax jingles |
| jingles-sax01.m4a | jingles_SAX01 | Sax jingles |
| jingles-sax02.m4a | jingles_SAX02 | Sax jingles |
| jingles-sax03.m4a | jingles_SAX03 | Sax jingles |
| jingles-sax04.m4a | jingles_SAX04 | Sax jingles |
| jingles-sax05.m4a | jingles_SAX05 | Sax jingles |
| jingles-sax06.m4a | jingles_SAX06 | Sax jingles |
| jingles-sax07.m4a | jingles_SAX07 | Sax jingles |
| jingles-sax08.m4a | jingles_SAX08 | Sax jingles |
| jingles-sax09.m4a | jingles_SAX09 | Sax jingles |
| jingles-sax10.m4a | jingles_SAX10 | Sax jingles |
| jingles-sax11.m4a | jingles_SAX11 | Sax jingles |
| jingles-sax12.m4a | jingles_SAX12 | Sax jingles |
| jingles-sax13.m4a | jingles_SAX13 | Sax jingles |
| jingles-sax14.m4a | jingles_SAX14 | Sax jingles |
| jingles-sax15.m4a | jingles_SAX15 | Sax jingles |
| jingles-sax16.m4a | jingles_SAX16 | Sax jingles |
| jingles-steel00.m4a | jingles_STEEL00 | Steel jingles |
| jingles-steel01.m4a | jingles_STEEL01 | Steel jingles |
| jingles-steel02.m4a | jingles_STEEL02 | Steel jingles |
| jingles-steel03.m4a | jingles_STEEL03 | Steel jingles |
| jingles-steel04.m4a | jingles_STEEL04 | Steel jingles |
| jingles-steel05.m4a | jingles_STEEL05 | Steel jingles |
| jingles-steel06.m4a | jingles_STEEL06 | Steel jingles |
| jingles-steel07.m4a | jingles_STEEL07 | Steel jingles |
| jingles-steel08.m4a | jingles_STEEL08 | Steel jingles |
| jingles-steel09.m4a | jingles_STEEL09 | Steel jingles |
| jingles-steel10.m4a | jingles_STEEL10 | Steel jingles |
| jingles-steel11.m4a | jingles_STEEL11 | Steel jingles |
| jingles-steel12.m4a | jingles_STEEL12 | Steel jingles |
| jingles-steel13.m4a | jingles_STEEL13 | Steel jingles |
| jingles-steel14.m4a | jingles_STEEL14 | Steel jingles |
| jingles-steel15.m4a | jingles_STEEL15 | Steel jingles |
| jingles-steel16.m4a | jingles_STEEL16 | Steel jingles |

## 2. Kenney「Impact Sounds」挑选 7 条（SFX 打击/爆炸样本，均入注册表）

- 作者/许可/转码：同公共信息 · 来源：<https://kenney.nl/assets/impact-sounds>（zip 直链 <https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip>）

| 文件 | 原名 | 注册表 kind | 用途（听感映射，A10 复核） |
| --- | --- | --- | --- |
| impactplate-heavy-000.m4a | impactPlate_heavy_000 | boom | 爆炸（重击铁板的轰响） |
| impactpunch-medium-000.m4a | impactPunch_medium_000 | hit | 打怪打击（中量拳击） |
| impactsoft-heavy-000.m4a | impactSoft_heavy_000 | hurt | 玩家受击（软体重击，更「疼」） |
| impactglass-light-000.m4a | impactGlass_light_000 | zap | 闪电劈落（轻玻璃碎裂的高频爆裂感） |
| impactbell-heavy-000.m4a | impactBell_heavy_000 | death | 死亡（重钟闷响的丧钟感） |
| impactmetal-heavy-000.m4a | impactMetal_heavy_000 | roar | 巨兽怒吼（重金属轰鸣） |
| impactsoft-medium-000.m4a | impactSoft_medium_000 | breath | 龙息扑声（软体中击的闷扑） |

## 3. Kenney「RPG Audio」挑选 3 条（SFX 样本，均入注册表）

- 作者/许可/转码：同公共信息 · 来源：<https://kenney.nl/assets/rpg-audio>（zip 直链 <https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip>）

| 文件 | 原名 | 注册表 kind | 用途（听感映射，A10 复核） |
| --- | --- | --- | --- |
| metalclick.m4a | metalClick | click | 转辙器咔哒（金属轻叩） |
| handlecoins.m4a | handleCoins | pick | 拾取（抖钱袋的硬币声） |
| knifeslice.m4a | knifeSlice | shoot | 发射（飞刀挥掷的破空声） |

## 4. OpenGameArt BGM 8 首（均入注册表 MUSIC_TRACKS，按场景分组）

- 下载日期：**2026-10-27**；许可：全部 **CC0**（各小节页面明示）。
- 转码：96k BGM 口径 + 先单声道化 + 首尾静音修剪 + 双遍 loudnorm（命令与差异说明见公共信息）；durMs 以转码后文件实测（`ffmpeg -i` Duration 换算毫秒）为准填入 MUSIC_TRACKS——MusicDirector 判曲毕的唯一依据（A3 接口备注②）。
- 选曲口径：2026-10-27 用户试听反馈「音乐太阴间，而且开始的时候有大段空白」。红线禁止 Minecraft/C418 原声（见本文件头），故改选 **Minecraft 风格**的 CC0 曲目并按场景分组（calm=主菜单/建造 · adventure=上界白天 · night=上界夜晚 · nether=下界 · battle=竞技场/坦克）；开头/曲间调度空白同步缩短（js/audio-core.js 的 SCHED，2026-10-27）。原三曲（Happy Adventure / Happy Trip To Mars / We Are Prophet，2026-10-23 批次；再早为 Crickets / The Abyss / Entering the Volcano）全部下线，文件已删（git 历史可溯）。

| 文件 | 曲目名 | 注册表 trackId | mood（场景） | 入库实测时长 |
| --- | --- | --- | --- | --- |
| bgm-infinite-world.m4a | Infinite World | infinite-world | calm（主菜单/建造） | 00:01:26.40（86400ms） |
| bgm-calm-piano.m4a | Calm Piano 1 (Vaporware) | calm-piano | calm（主菜单/建造） | 00:02:40.66（160660ms） |
| bgm-flowerbed-fields.m4a | Flowerbed Fields | flowerbed-fields | adventure（上界白天） | 00:00:39.79（39790ms） |
| bgm-going-up.m4a | Going Up | going-up | adventure（上界白天） | 00:00:55.00（55000ms） |
| bgm-morning-sky.m4a | Morning Sky (piano) | morning-sky | night（上界夜晚） | 00:02:12.00（132000ms） |
| bgm-seeing-pool.m4a | The Seeing Pool | seeing-pool | nether（下界） | 00:01:08.92（68920ms） |
| bgm-8bit-battle.m4a | 8-Bit Battle Loop | 8bit-battle | battle（竞技场/坦克） | 00:00:26.62（26620ms） |
| bgm-rpg-battle.m4a | RPG Battle Loop | rpg-battle | battle（竞技场/坦克） | 00:00:59.08（59080ms） |

### 4.1「Infinite World」（calm）

- 作者：Umplix · 发布：2022-03-03 · 许可：CC0（页面明示）
- 来源：<https://opengameart.org/content/infinite-world>（wav 直链 <https://opengameart.org/sites/default/files/infinite_world.wav>）
- 页面自述「A calm song, kind of Minecraft-ish」，标签 calm/piano/synth/minecraft——最贴近 MC 原声氛围的一首，主菜单/建造的基底。

### 4.2「Calm Piano 1 (Vaporware)」（calm）

- 作者：cynicmusic（The Cynic Project）· 发布：2019-05-11 · 许可：CC0（页面明示）
- 来源：<https://opengameart.org/content/calm-piano-1-vaporware>（mp3 直链 <https://opengameart.org/sites/default/files/003_Vaporware_2.mp3>）
- 舒缓铺底 + 明亮钢琴旋律；源文件首/尾各有 ~1.7s / ~2.1s 静音，转码时已修剪。

### 4.3「Flowerbed Fields」（adventure）

- 作者：Zane Little Music · 发布：2023-05-14 · 许可：CC0（页面明示）
- 来源：<https://opengameart.org/content/flowerbed-fields-loop>（ogg 直链 <https://opengameart.org/sites/default/files/flowerbed_fields.ogg>）
- 「A cute chiptune loop to get an adventure started!」——上界白天探索的明亮开场。

### 4.4「Going Up」（adventure）

- 作者：ansimuz（Luis Zuno）· 发布：2022-03-20 · 许可：CC0（页面明示）
- 来源：<https://opengameart.org/content/going-up-adventure-chiptune>（zip 直链 <https://opengameart.org/sites/default/files/going_up_files_0.zip>，取包内 `Going Up.wav`；包内附作者许可说明，允许商用/改编/再分发，与页面 CC0 一致）
- 冒险向 chiptune，原为无缝循环制作；一次性播放口径下取整曲 55s。

### 4.5「Morning Sky (piano)」（night）

- 作者：Centurion_of_war · 发布：2025-08-24 · 许可：CC0（页面明示）
- 来源：<https://opengameart.org/content/morning-sky>（piano 版 flac 直链 <https://opengameart.org/sites/default/files/morning_2d.1_piano.flac>；另一混音 `morning_2d.2_0.ogg` 未采用）
- 「A calm chill theme. Good for a chill morning/evening」——取钢琴版做夜晚的舒缓口径。

### 4.6「The Seeing Pool」（nether）

- 作者：Umplix · 发布：2022-04-06 · 许可：CC0（页面明示）
- 来源：<https://opengameart.org/content/the-seeing-pool>（wav 直链 <https://opengameart.org/sites/default/files/the_seeing_pool.wav>）
- 洞穴/地下水潭 ambient；源文件尾部有 ~6s 静音，转码时已修剪。下界是暗红异世界，配神秘但不刺耳的环境曲。

### 4.7「8-Bit Battle Loop」（battle）

- 作者：Wolfgang_ · 发布：2017-12-20 · 许可：CC0（页面明示）
- 来源：<https://opengameart.org/content/8-bit-battle-loop>（ogg 直链 <https://opengameart.org/sites/default/files/8BitBattleLoop_0.ogg>）
- 短促 8-bit 战斗循环（26.6s），竞技场/坦克的快节奏底色。

### 4.8「RPG Battle Loop」（battle）

- 作者：iamoneabe · 发布：2022-03-08 · 许可：CC0（页面明示「CC Zero, as always」）
- 来源：<https://opengameart.org/content/rpg-battle-loop>（mp3 直链 <https://opengameart.org/sites/default/files/rbl_0.mp3>）
- RPG 风格战斗循环（59.1s），与 8-bit 首尾时长错开避免连播同感。

- 备注：mood 为曲目听感 + 页面自述推断，真机复核不满意可再换（OpenGameArt CC0 曲库充足）；八曲统一 -21 LUFS 归一，条目增益一律 g=1，无需逐曲配平。
