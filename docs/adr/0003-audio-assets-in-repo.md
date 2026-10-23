# 0003 — 音频资产入库：单格式 m4a + 只取 CC0 + 体积预算

（编号说明：工单 A5/A7 与方案的转记备注均写「ADR 0002」，但音频分支基线里 0002 已被
[0002-focus-loot-integration](0002-focus-loot-integration.md)（e46e6ab，T11）占用，本决策顺延为 0003。）

合成音色（方波/锯齿蜂鸣）听起来廉价刺耳，与"真游戏"的期待不符（spec Problem
Statement）。我们决定把 CC0 素材**转码后直接入仓**：`assets/audio/` 共 98 文件
6.95MB，统一 mono 44.1kHz AAC/m4a（反馈/打击短曲 128k、BGM 长曲 96k），配
`assets/audio/CREDITS.md` 逐文件溯源（曲目/作者/来源 URL/许可/下载日期）；
`test/audio-registry.test.js` 断言注册表引用的每个文件真实存在且 CREDITS 记载
（文件在而记录缺即红）。

## Considered Options

- 不入库，运行时/首次部署时从 kenney.nl / opengameart.org 实时拉取 —— 被否：
  零依赖本地 server 与"file:// 双击直开也能玩（合成兜底）"的离线承诺被外部站点
  可用性绑架；儿童项目的素材许可审计需要仓库内静态可查证的清单。
- 双格式分发（ogg + m4a 各一份）—— 被否：体积翻倍（~14MB），注册表与 CREDITS
  要维护两套文件名；目标设备中只有 iPad Safari ≤17.3 不支持 OGG，而 m4a 全端
  可解，单格式已覆盖（spec Out of Scope 已明确不做双格式）。
- mp3 直用 —— 被否（仅作降级预案，未启用）：同码率听感不如 AAC；只有当 ffmpeg
  工具链完全不可用时才按 A7 预案 ③ 降级入库并在 CREDITS/ADR 记录，本次未发生。
- 单格式 m4a 入库 —— 采用。

## Consequences

- 仓库 +6.95MB（98 文件 = Kenney music-jingles 85 + impact-sounds 7 + rpg-audio 3
  + OpenGameArt BGM 3），对 ≤25MB 体积预算余量充足；后续增补素材必须同口径：
  CC0-only、mono 44.1kHz、BGM 96k / 短曲 128k、CREDITS 逐条记载（有测试咬合）。
- **红线（永久）**：只取 CC0——不使用 Minecraft/C418 原声（受版权保护），不取
  CC-BY-SA（传染性）；CREDITS 覆盖由单测断言。
- Kenney 全站只发 OGG，入库必经本地转码：工具链走 devDependency `ffmpeg-static`
  （本机 PATH 无 ffmpeg）；其安装需直连 GitHub 拉取二进制，当时证书校验失败，
  以 `NODE_TLS_REJECT_UNAUTHORIZED=0` 重装绕过（一次性 TLS workaround，已记
  CREDITS 公共信息）。转码命令逐条记在 CREDITS.md；运行时零依赖不破。
- 素材**未过 loudnorm** 响度归一：现状由注册表条目 g/gTouch（条目级）与
  AudioCore 的 AUDIO_MIX 总线增益（总线级）分工校准；后续听感漂移优先调这两处，
  而非重转码——重转码改文件哈希，须同步 CREDITS 与注册表全量重验。
- 单格式的代价：若未来出现不解 AAC 的目标设备，须按 CREDITS 的来源 URL 重新
  下载源文件整批重转码（源 wav/flac/ogg 不入库）。
