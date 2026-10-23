# assets/audio 素材溯源清单 (CREDITS)

> 红线：本目录全部素材均为 **CC0**（公有领域贡献），无一例外；不含
> Minecraft / C418 原声任何内容。注册表（js/audio-registry.js）引用的
> 每个样本/曲目文件都必须在本文件记载 —— test/audio-registry.test.js
> 的 CREDITS 覆盖断言逐条咬合（文件在而记录缺即红）。

## 公共信息（各节通用）

- 下载日期：全部 **2026-10-23**（PowerShell `Invoke-WebRequest`，源 zip/wav/ogg 原件存仓库外临时目录，不入库）
- 许可：[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)（作者放弃一切权利，可商用、可改编、署名非义务——为溯源与儿童项目礼节仍逐条记录）
- 转码：ffmpeg 6.1.1（devDependency `ffmpeg-static` 附带构建；本机 PATH 无 ffmpeg，直连 GitHub 拉取其二进制时证书校验失败，需 `NODE_TLS_REJECT_UNAUTHORIZED=0`，详见工单 A7 / ADR 0003）
- 转码命令（128k 反馈短曲 / 打击样本）：

  ```
  ffmpeg -i <源> -ac 1 -ar 44100 -c:a aac -b:a 128k <out>.m4a
  ```

  转码命令（96k BGM 长曲）：

  ```
  ffmpeg -i <源> -ac 1 -ar 44100 -c:a aac -b:a 96k <out>.m4a
  ```

  统一 mono 44.1kHz AAC；未加 loudnorm——响度由注册表条目 g/gTouch 与 A3 的 AUDIO_MIX 总线分工校准（A10 听感复核）。

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

## 4. OpenGameArt BGM 3 首（均入注册表 MUSIC_TRACKS）

- 转码：96k 命令（见公共信息）；durMs 以转码后文件实测（`ffmpeg -i` Duration 换算毫秒）为准填入 MUSIC_TRACKS——MusicDirector 判曲毕的唯一依据（A3 接口备注②）。

### 4.1「Crickets - General calm ambient music」1 首

- 作者：SpringySpringo · 发布：2022-11-22 · 许可：CC0（页面明示）
- 来源：<https://opengameart.org/content/crickets-general-calm-ambient-music>（wav 直链 <https://opengameart.org/sites/default/files/crickets.wav>）

| 文件 | 曲目名 | 注册表 trackId | mood | 源时长 |
| --- | --- | --- | --- | --- |
| bgm-crickets.m4a | Crickets | crickets | calm（主菜单/建造） | 00:03:29.36 |

### 4.2「Ambience of a Fallen Age」2 首

- 作者：Umplix · 发布：2022-04-22 · 许可：CC0（页面明示）
- 来源：<https://opengameart.org/content/ambience-of-a-fallen-age>（wav 直链见各行）

| 文件 | 曲目名 | 注册表 trackId | mood | wav 直链 |
| --- | --- | --- | --- | --- |
| bgm-the-abyss.m4a | The Abyss | the-abyss | dark（下界/冒险） | <https://opengameart.org/sites/default/files/the_abyss.wav> |
| bgm-entering-the-volcano.m4a | Entering the Volcano | volcano | battle（竞技场/坦克） | <https://opengameart.org/sites/default/files/entering_the_volcano.wav> |

- 备注：同包另两首（A Forgotten World / Ruins of an Ancient Culture）已下载至仓库外临时目录备用，本单按「2~3 首」上限未入库；A10 复核若需换曲可增补并同步本文件。
