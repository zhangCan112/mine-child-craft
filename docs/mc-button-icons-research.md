# Minecraft 按钮图标视觉语言研究报告（Button Icon Visual Language）

> **用途**：为 my-craft-demo 的触屏/菜单按钮像素化（替换 ⬆️⬇️📷⛏️🎒📦🧹✕🎵⬅️➡️❤ 等 emoji 占位）提供官方视觉语言依据。物品图标已全量像素化（js/icons.js 像素图标工坊），本报告覆盖**按钮/HUD 件**这一缺口。
> **调研日期**：2026-10-24。所有像素结论均由当日从 [Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples) main 分支与 Java 1.20.1 官方资产镜像**逐像素解码取证**（方法见 §7.3），非肉眼读图或二手转述。
> **操作语义**（按钮何时出现、什么手势触发）不在本报告重复——见 [mc-touch-controls-research.md](mc-touch-controls-research.md)；本报告只管**长什么样**。
> **版权口径**：报告内对官方贴图的色值/网格描述是「事实性考据」，供理解语言；入库代码只落我方自绘字符画（§6）。

---

## 1. 结论速览表：我方按钮 → MC 对应物 → 自绘口径

图例：〔钮〕= 图标画在按钮底板上；〔浮〕= 无底板纯图标浮在画面上。我方自绘统一走像素图标工坊 16×16 字符画管线（js/icons.js）。

| 我方按钮（现状） | 官方对应物（文件 · 尺寸） | 官方画的是什么（像素事实） | 我方自绘口径（16×16 + 建议色值） | 来源 |
|---|---|---|---|---|
| 跳跃 `⬆️`（touchJump） | `textures/ui/jump.png` · 22×22〔钮〕 | **上箭头 + 地面线**：2px 尖顶向下 4 行扩至 8px 的箭头 + 4px 短杆，隔 2 行再一条 8px 底杠；黑色图标 | 黑色（#1a1a1a）上箭头 + 底杠，居中 8px 宽；配灰钮底（§2.2） | S1 |
| 下降 `⬇️`（touchDown） | `textures/ui/sneak.png`（地面）/ `flyingdescend.png`（飞行） | **下箭头 + 地面线**：4px 竖杆起手 → 7px 横肩 → 6→4→2px 收尖的下行箭头 + 底杠 | 黑色下箭头 + 底杠（跳跃的垂直镜像，起手横肩可简化） | S1 |
| 视角 `📷`（touchCam） | `textures/ui/perspective.png` · 18×18〔钮〕 | **菱形/立方体线框**（非相机！）：黑色菱形环带内部笔触；整钮 80% 不透明度 | 黑色立方体线框（等距立方体三面轮廓），不用相机图案——官方语义是"切换视角"而非"拍照" | S1 |
| 主动作 `⛏️`（holdAct 挖/打） | `textures/ui/attack.png`（攻击=斜剑）；教学图 `how_to_play/break-block-touch`（挖掘=镐） | **斜向武器剪影**：黑剑刃自右上斜贯左下，刃侧留 1–2px 灰高光，左下护手团块 | 我方挖/打合一，沿用镐语义：黑色镐剪影（弧头+斜杆），与 icons.js `PICK_ART` 同构但**按钮版**（更粗、纯剪影少渐变） | S1/S2 |
| 暂停 `⏸`（touchPause） | `textures/ui/pause_icon.png` · 6×8〔浮〕 | **纯白双竖条**：两枚 2×8px 白条，间距 2px；无底板 | 白色 #ffffff 双竖条 2×7，间 3px；顶部浮键无底钮 | S1 |
| 背包 `🎒`（rare 键/面板标题） | `textures/ui/inventory_icon.png` · 19×13〔浮〕 | **褐色箱形容器**：#986B27 主面 + #674915 暗部 + #1D1812 描边，顶窄底宽带开盖缝 | 褐色箱形（复用我方 `CHEST_ART` 的棕系 #b1804f/#6b451f 重画剪影版）；官方口径是"容器"不是"书包" | S1 |
| 关闭 `✕`（各面板） | `textures/gui/newgui/X.png` · 16×16 | **9 像素紧凑 X**（#464546 深灰）：5×5 网格的两条对角线；hover 变白并浮出灰底 | #464546 深灰紧凑 X（5×5 对角线即可，勿画大骨架 X）；hover/按压态走 CSS 变色 | S1 |
| 翻页 `⬅️➡️`（范式大键/页签） | `newgui/LeftArrow.png`/`RightArrow.png` · 16×16；小箭头 `arrowLeft.png` · 8×8 | **白色实心块状箭头**：粗 chevron 头+短杆，台阶状边缘无描边；8×8 小箭头在**右下带 1px #1C1C1C 落影** | 白色块箭头 + 右下 1px #1c1c1c 落影（左上光源惯例的直接证据）；深底面板上用白、浅底上用深灰 | S1 |
| 心形 `❤️`（下界 toast/HUD 语义） | `textures/ui/heart.png`（BE）/ Java `icons.png`(52,0) · 9×9 | **三色心，无描边**：#FF1313 主色 + #BB1313 右下暗面 + **#FFC8C8 左上圆顶单像素高光**；两版逐像素同源 | 直接采纳三色配方画 9×9（16×16 画布内嵌）；空心底 = #282828 面 + #000000 右下描边 | S1/S4 |
| 音量 `🎵`（volBtn/滑杆标签） | 无按钮对应（Java 音乐符号属唱片机 UI） | — | 自定语义：白色/深灰**喇叭 + 两道声波弧** + 右下 1px 落影；MC 没有音量按钮，语义自创但沿用"白图标+右下影"语言 | S1（缺位事实） |
| 整理 `🧹`（sortInv） | 无直接对应（`newgui/trash.png` 是**丢弃**不是整理） | 垃圾桶 = #464546 单色剪影 + 竖条镂空 | 勿画扫帚/垃圾桶；建议画"**物品归槽**"：2–3 个小方块+向下箭头收入格槽（自定语义，形状语言取自槽位格） | S1/S2 |
| 熔炉火 `♨️`（烧炼进度/站点） | Java `container/furnace.png` 右上 14×14 火焰 | **三色火焰**：#FFB600 橙焰身 + #FFFF1F 亮黄焰心 + #D84C45 红缘，灰噪底 | 沿用我方 icons.js `FURNACE_ART` 火焰色系（#ff8c1a/#ffc04d），画独立火焰小图（梯形焰+内芯） | S4 |
| 类别页签（📦 全部/⛏️ 工具） | Java `widget/tab*.png`；BE `newgui/TabFront/TabBack` · 12×10 | **梯形页签**：TabFront/TabBack 成对（前置/后退），选中前置亮面、未选后退暗面，与面板连体（本行为文件名语义+映射佐证，未逐像素取样） | 页签画梯形（顶边短底边长），选中亮色+未选暗色；tab 上的类别图标复用 iconOf | S2/S7/S13 |
| 摇杆（joyZone，无 emoji） | `ui/joystick_frame.png` 64×64 + `joystick_knob.png` 32×32 | 框=黑细外圈+多层 #B1B2B5/#D0D1D4 半透明同心环（alpha 25–75%）；杆头=**标准灰钮配方放大、无图标** | 已有 CSS 实现；如像素化：杆头复用钮配方（§2.2），框用半透明白圈 | S1 |
| 快捷栏选中框（hotbar） | BE `selected_hotbar_slot.png` / Java `widgets.png`(0,22) · 24×24 | **淡绿白噪点框**：#D5E8D0 亮 / #A1B29D 中 / #5F6D5C 暗 + 黑外框 + 半透明黑内环，内部全透明；**不是纯白**（常见误记） | 有意偏离：用我方暖黄 #ffd83d 系描亮框（儿童辨识度 + 版权距离）；形状语言取"约 2px 均匀粗框 + 上下边噪点"，四角加重是我方附加设计（非官方特征） | S1/S4/S5 |
| 疾跑（未上线，预留） | `textures/ui/sprint.png` · 22×22〔钮〕 | **双右向折角箭头 »**：两组 3px 宽 chevron 上下错位 | 黑色 » 双 chevron | S1 |
| 状态表达（全部按钮） | `*_pressed.png` / `sprint_disable.png` | 按下=图标黑→#E6E6E6 白 + 内圈 #686868→#A8A8A8 + **整钮下移 1px** + 底唇减半；禁用=整钮 60% 不透明度 | CSS：`:active` 时 translateY(1px)+图标变白；禁用 opacity .6 | S1 |
| 按钮底板（chrome） | `ui/jump.png` 等 22×22 全族 | 见 §2.2 配方表 | 见 §5.0 我方钮底口径 | S1 |

---

## 2. 基岩触屏按钮族谱与逐张考据

### 2.1 三代按钮族谱（官方仓库存放位置即证据）

| 代际 | 目录 | 内容 | 来源 |
|---|---|---|---|
| D-pad 经典（≤1.18 主用） | `resource_pack/textures/gui/controls/` | up/down/left/right、四斜角、jump/jump_dpad、sneak/sneak_dpad、flying/water 四态、dismount、large_button（70×22 空宽钮）——各带 `_pressed` | https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/textures/gui/controls |
| 新触控（1.19.50+，2023 前后至今） | `resource_pack/textures/ui/`（约 1826 个文件） | jump/sneak/flyingascend/flyingdescend/waterascend/waterdescend/attack/interact/perspective/sprint/sprint_disable/pick_block/mount/joystick_frame/joystick_knob/pause_icon/inventory_icon/chat_keyboard/chat_send/selected_hotbar_slot/heart 族/hotbar_0~8/trash 族/close_X_button 族…各带 `_pressed` | https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/textures/ui |
| 跨端菜单件（Java 观感同源） | `resource_pack/textures/gui/newgui/` | X/XHover/XPress、LeftArrow/RightArrow/UpArrow/DownArrow、arrowLeft、arrow_large、buttonNew（5×5 九宫格）、ButtonWithBorder 三态、trash、TabFront/TabBack 族 | https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/textures/gui/newgui |

文件名清单与 wiki 整理页交叉一致：https://minecraft.wiki/w/Bedrock_Edition_GUI,_UI,_and_Ore_UI_textures （该页 §HowToPlay 另有 `break-block-touch`、`place-block-touch`、`camera-touch`、`fly-touch` 等教学图——是大幅说明插画，不是按钮贴图）。

**代际关系**：`gui/controls/` 与 `ui/` 的 jump/sneak/fly/water 四态键**逐像素同值**（22×22 同配方）；`_dpad` 后缀变体改用「图标镂空」（图标区像素透明化）且四角不透明（方角）。新触控把按钮迁到 `ui/` 与 HUD 件同目录，是 1.19.50 触控重设计的资产侧痕迹（时间线见 mc-touch-controls-research.md §8）。

### 2.2 22×22 标准钮「外框配方」（逐像素取证，全族一致）

取样：`ui/jump.png`、`ui/sneak.png`、`gui/controls/large_button.png`（70×22 证明配方横向可延展）。

| 部位 | 像素宽 | 色值 | 备注 |
|---|---|---|---|
| 最外描边 | 1px | `#000000` | 四角 1px 透明 → 1px 圆角切角 |
| 内圈环 | 2px | `#686868` | 比钮面深一档的"下沉"环 |
| 钮面 | 16×16 | `#808080` | 图标画在这里 |
| 底部唇 | 2px | `#39393C` | 仅底边（+底角过渡 #505051/#121213），顶边**无**亮线——靠环与面的明度差成像 |
| 图标 | — | `#000000` | 纯黑剪影，无描边无内渐变（灰面已承担对比） |

来源（raw 文件，逐张可复核）：
- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/jump.png
- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/gui/controls/large_button.png

### 2.3 状态四态（官方状态机）

| 状态 | 取样文件 | 像素变化 |
|---|---|---|
| 常态 | `ui/jump.png` | §2.2 配方 |
| **按下** | `ui/jump_pressed.png` | ① 图标黑→`#E6E6E6`（近白反转）② 内圈 `#686868`→`#A8A8A8`（环反而变亮）③ 顶行整体变透明 = **整钮下移 1px** ④ 底唇 `#39393C` 从 36px 缩到 18px（高度减半，"压平"） |
| **禁用** | `ui/sprint_disable.png` | 全图 alpha=153（60%）；面色提为 `#9C9C9C`、圈 `#898989`、描边 `#383838`、底唇 `#646467`——同形降饱和整体变淡 |
| **常态半透明** | `ui/perspective.png` | 全图 alpha=204（80%）——低频键弱化在画面上 |

- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/jump_pressed.png
- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/sprint_disable.png
- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/perspective.png

### 2.4 各语义图标逐张（16×16 面内的黑像素形状，全部一手解码）

**跳跃 jump**：上箭头（尖顶 2px 起、4 行扩到 8px）+ 4px 短杆，空 2 行，8px 地面线。读作"从地面跃起"。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/jump.png

**潜行/下降 sneak**：4px 竖杆 3 行 → 7px 横肩 → 下行箭头 6→4→2px 收尖 → 地面线。与跳跃垂直镜像成对。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/sneak.png

**飞行升降 flyingascend / flyingdescend**：小上箭头+竖杆，下接**两侧外扩斜线**（翼/张腿，x8/x13 → x6/x15），再地面线；descend 为整体翻转。升/降不换符号家族，只翻方向。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/flyingascend.png

**水中升降 waterascend / waterdescend**：飞行升降同形 + 左右各一列 2px 间隔的**虚线水波**（黑白相间的短横栈）。语义叠加不改母形。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/waterascend.png

**攻击 attack**：**斜剑剪影**——黑色刃带自右上贯左下，刃侧留 1–2px 钮面灰当高光，左下有护手/柄团块；pressed 版白剑形更清晰。这是"攻击"键的官方答案：**武器剪影，不是拳头**。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/attack.png

**交互 interact**：上竖条(2×4) + 中排左右两条(4×2) + 下竖条(2×4)，行间断开。形似**俯视摊开的手掌**（中指/张开指/腕）——官方无文字描述，此为像素事实+谨慎推断。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/interact.png

**视角 perspective**（18×18）：黑色**菱形/立方体线框**带内部笔触，整钮 80% 不透明度。**官方视角切换不画相机**。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/perspective.png

**疾跑 sprint**：两个右向 chevron（»）上下错位，前小后大。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/sprint.png

**取块 pick_block**：方框线 + 内部虚线纹（边界框/框选意象）。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/pick_block.png

**骑乘/下马 mount / dismount**：四足坐骑侧影（顶双竖条=耳/缰，中部宽躯干，底部虚线腿）。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/mount.png

**暂停 pause_icon**（6×8）：纯白双竖条，无底钮（顶部浮键直接叠在画面上）。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/pause_icon.png

**背包 inventory_icon**（19×13）：褐色箱形容器（#986B27 / #674915 / #1D1812 描边），顶窄底宽带缝。语义是"容器/箱子"系，不是书包。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/inventory_icon.png

**聊天 chat_keyboard**（9×7）：#4C4C4C 深灰键盘——3 排黑白相间的"键"+ 1 条通栏空格条。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/chat_keyboard.png

**发送 chat_send**（21×18）：白底 #F4F3F0 圆角块 + 深灰描边，中央灰 #8E8E97 **纸飞机/三角发送符**。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/chat_send.png

**摇杆 joystick_frame**（64×64）/ **joystick_knob**（32×32）：框 = 黑细外圈 + #B1B2B5/#D0D1D4 多层半透明同心环（alpha 64/128/191，约 25–75%）；杆头 = §2.2 标准钮配方原样放大、**无图标**。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/joystick_frame.png

**镐 icon_iron_pickaxe**（26×26，商店/进度用）：斜 45° 木柄 + 顶部弧形铁镐头（#838383 铁 + #C1C1C1 亮 + #493615 柄），与我方 `PICK_ART` 的「头右上、柄左下」惯例一致。
https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/icon_iron_pickaxe.png

### 2.5 新版触控（2023+）动作键口径：无色彩语义（问题 4 答案）

`attack` / `interact` / `pick_block` / `sprint` / `jump` 全族**同为灰面黑图标的标准钮**——挖掘、攻击、放置之间**没有攻击红/放置绿一类的颜色编码**；区分只靠图标剪影（剑=攻击、手掌=交互、线框=取块、»=疾跑、箭头=跳/蹲）。颜色只出现在 HUD 状态件上（心=红、饥饿=棕、护甲=银），不出现在动作按钮上。放置在默认触控模式下无按钮（直接点按世界，见 mc-touch-controls-research.md §3.9）。

来源：§2.4 各文件 + https://minecraft.wiki/w/Controls （Touch §：action buttons 仅准星模式出现）。

---

## 3. Java 版 HUD/按钮件考据（与基岩交叉验证）

### 3.1 心形 ❤：9×9 三色，Java/基岩逐像素同源

- Java 1.20.1 `icons.png` (52,0) 裁切 9×9 与 BE `textures/ui/heart.png` **色值逐像素相同**：主体 `#FF1313`，右下暗面 `#BB1313`（收尖处与右瓣），**左上圆顶 1 像素高光 `#FFC8C8`**，无描边。
- 空心底（Java icons.png (16,0) / BE `heart_background.png`）：`#282828` 暗灰面 + `#000000` 右下描边。
- 半心 `heart_half.png`：左半红右半透明，正中硬切。
- 佐证"两版同图"：wiki 文件名 `Heart (texture) JE1 BE1.png`（JE/BE 共用同一修订版命名）—— https://minecraft.wiki/w/File:Heart_(texture)_JE1_BE1.png ；wiki API 元数据 `Heart (icon).png` 9×9（§7.2 查询记录）。
- 结构惯例如实记录：心为 7×7 有效形上双圆顶、下收单尖（9×9 含 1px 呼吸边）。**注意"7×7？"的常见猜测不对——两版 HUD 心都是 9×9 画布、7px 宽有效形。**

来源：
- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/heart.png
- https://github.com/InventivetalentDev/minecraft-assets/tree/1.20.1 （官方资产社区镜像，`assets/minecraft/textures/gui/icons.png`）
- https://minecraft.wiki/w/Category:Java_Edition_GUI_textures （心族文件全部 9×9）

### 3.2 快捷栏与选中框：淡绿白噪点框（不是纯白）

- Java 1.20.1 `widgets.png` (0,22) 裁切 24×24 与 BE `selected_hotbar_slot.png` **逐像素同源**：外 1px 黑框 → 半透明黑（#040404@68%）内环 → `#D5E8D0` 亮 / `#A1B29D` 中 / `#5F6D5C` 暗三阶**淡绿白**框线，上下边带 dither 噪点，**内部 18×18 全透明**（只描框不盖物）。
- Java 1.20.2+ 拆分文件 `sprites/hud/hotbar_selection.png` 为 **24×23**（底行被裁）；Bug 追踪记录确认"widgets.png 时代曾有完整 24×24、与基岩一致，后被裁一行"—— https://bugs.mojang.com/browse/MC-265021
- 快捷栏槽格（Java `widgets.png` (0,0) 20×22 与 BE `hotbar_0.png` 同源）：`#272505`@73% 的 dither 暗底 + 上下 1px 黑框 + 左缘 `#939393` / 右缘 `#7E7E7E→#5D5D5D` 灰侧线——框线方向虽同为左亮右暗，但内底是大面积半透明暗色，成像是"细亮包边的深色槽"。
- 文件→UI 映射佐证：https://resourcepackcreator.com/guide/minecraft-gui-textures （hotbar 182×22、hotbar_selection 24×24 frame、九宫格边车等）

来源：
- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/selected_hotbar_slot.png
- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/ui/hotbar_0.png
- https://github.com/InventivetalentDev/minecraft-assets/tree/1.20.1

### 3.3 石质按钮 bevel：顶左亮、底右暗、悬停变蓝紫

**最小九宫格 `newgui/buttonNew.png`（5×5）**——经典石钮 bevel 的最小完整表达：

| 部位 | 色值 |
|---|---|
| 顶边+左边 1px | `#FFFFFF`（高光） |
| 钮面 | `#D4D4D4` |
| 底边+右边 1px | `#373737`（暗） |
| 四角 | `#8B8B8B`（过渡） |

https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/gui/newgui/buttonNew.png

**带描边钮 `ButtonWithBorder` 三态**（8×8，深色 UI 上的钮）：
- 常态：`#131313` 1px 描边 + `#C6C6C6` 面 + 左上 `#FFFFFF` 高光 + 右下 `#585658` 暗（**外凸**）。
- **悬停：面色整体转蓝紫** —— `#9EA9EE` 主 / `#C0C9FF` 亮 / `#6A73AE` 暗，描边变白。"悬停变蓝"在基岩里的落点就是这套蓝紫色板。
- 按压：亮/暗对调（顶行出现 `#9DA7E7`，底行变 `#C0C9FF`）——bevel 反转的"凹陷"感。

来源：
- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/gui/newgui/ButtonWithBorder.png
- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/gui/newgui/ButtonWithBorderHover.png
- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/gui/newgui/ButtonWithBorderPressed.png

Java 侧文件对应（`sprites/widget/button.png` 九宫格 + `button_highlighted.png` 悬停态）见映射文：https://resourcepackcreator.com/guide/minecraft-gui-textures ；wiki 分类页收录 `Button.png` 22×22 / `Button highlighted.png` / `Button disabled.png`（Realms 网格钮族）：https://minecraft.wiki/w/Category:Java_Edition_GUI_textures

### 3.4 关闭 ✕ 与翻页箭头

- `newgui/X.png`（16×16）：**9 像素紧凑 X**，`#464546` 深灰单色；`XHover`：浮出 `#AEAEAE` 灰底 + **白 X**；`XPress`：灰底 + 深灰 X 回落。
- `newgui/LeftArrow / RightArrow / UpArrow / DownArrow`（16×16）：**白色实心块箭头**（宽 chevron 头 + 短杆，边缘走像素台阶，无描边）。
- `newgui/arrowLeft`（8×8）：白色小箭头 + **右下 1px `#1C1C1C` 落影**——"左上光源、右下投影"的最小证据。
- Java 侧同族：`Page backward/forward (highlighted)` 12×17（配方书页箭头）、`Close.png` 16×16（wiki 分类页收录尺寸）。

来源：
- https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/gui/newgui/X.png （同目录 XHover/XPress/LeftArrow/RightArrow/arrowLeft）
- https://minecraft.wiki/w/Category:Java_Edition_GUI_textures

### 3.5 熔炉火焰（14×14）

Java 1.20.1 `container/furnace.png` 右上角 14×14 火焰取样：`#FFB600` 橙焰身 + `#FFFF1F` 亮黄焰心 + `#D84C45` 红缘，叠在 `#C6C6C6/#8B8B8B` 灰 dither 底上。wiki 拆分文件名 `Lit progress.png` 14×14 与之对应。
来源：https://github.com/InventivetalentDev/minecraft-assets/tree/1.20.1 （`gui/container/furnace.png`）+ https://minecraft.wiki/w/Category:Java_Edition_GUI_textures

---

## 4. MC 图标通用设计语言提炼（自绘总纲）

每条均由 §2/§3 像素证据直接支撑：

1. **图标居中于圆角方钮，或无框纯图标浮键**——两栖口径：高频操作键走〔钮〕（22×22 配方），顶部低频键走〔浮〕（pause 6×8 白条）。没有"圆钮+白图标+长投影"式的现代 App 语言。
2. **按钮图标一律单色剪影**：常态黑（#000000 级），按压变白（#E6E6E6 级）；不画材质、不画渐变（渐变留在物品图标里）。
3. **1px 黑描边是分界线惯例**：钮外框、选中框、槽格外圈都是 1px #000000；图标本身在灰面上**不描边**，在画面上（浮键）用纯白/纯黑。
4. **光照方向：左上亮、右下暗**——心形高光 #FFC8C8 在左上圆顶、暗面 #BB1313 在右下；arrowLeft 落影在右下 1px；按钮 bevel 顶左 #FFFFFF/底右 #373737。全套一致。
5. **方向语义用箭头家族表达，状态语义用叠加小元素**：跳/蹲/飞升/飞降同族翻转；"水中"= 母形 + 虚线水波；"地面"= 底杠。新语义优先复用旧形+附加元素，不发明新形。
6. **三态状态机**：常态 → 按下（图标反转白 + 下移 1px + 底唇减半）→ 禁用（整钮 60% alpha）。悬停（菜单钮专属）= 蓝紫 #9EA9EE 系。
7. **外凸/深槽成对**：按钮/钮帽外凸（顶左 #FFFFFF 亮、底右 #373737 暗，1–2px 明度差不画大阴影）；槽格则是"细亮包边 + 大面积半透明暗底"的深槽观感（§3.2）。两者的框线方向可同向，靠**内底明度**区分凸凹。
8. **动作键无色彩语义**（§2.5）：颜色只给 HUD 状态件（心红、焰橙黄、选中框淡绿白）。
9. **半透明分层**：常驻 HUD 件可 60–80% 不透明度弱化（perspective 80%、joystick 25–75%、选中框内环 68%）——画面信息优先于控件存在感。

---

## 5. 自绘建议清单（16×16 字符画可直接照画）

### 5.0 按钮底板（CSS 层，不进字符画）

钮底建议走 CSS（与 focus.css 已有的"MC 立体按钮 bevel"同类）：1px #000 边框 + 2px 圆角 + 面色我方石色系 `#8a8f98`（对齐 PIX_TIER.stone，比官方 #808080 略蓝一点拉开距离）+ `box-shadow: inset 0 -2px 0 #39393c, inset 0 2px 0 #a3a8b0`（底唇+顶亮线）+ `:active` 时 `translateY(1px)` 且图标层换白。禁用 `opacity:.6`。悬停（菜单大钮）面色转我方蓝紫 `#9ea9ee` 系。

### 5.1 图标逐个（16×16 网格内有效形 ≤12×12，'.'=透明）

1. **跳跃**：上箭头——行 y2..y5 箭头（顶 2px 宽、每行 +2 至 8px），y6..y8 杆 4px，y10 一条 8px 地面线；前景黑 `#1a1a1a`。
2. **下降**：镜像——y5 地面线在顶亦可（官方在底），主体下箭头（8→2 收尖）+ 短杆；与跳跃共享色板成对出现。
3. **视角**：等距立方体线框——外六边形轮廓 1px 黑线 + 三条内棱线汇聚中心；不用相机。
4. **主动作（挖/打）**：镐剪影——顶部 7px 宽弧头（两翼下垂 2px）+ 斜 45° 杆到左下；柄 `#7a5228`、头 `#8a8f98` 单层（按钮版比物品版少渐变，远看是剪影）。
5. **暂停**：双竖条 2×7 白 `#ffffff`，间 3px。
6. **背包**：箱形剪影——顶盖横条 + 梯形箱身 + 中央锁点；褐 `#b1804f` 面/`#6b451f` 暗/`#1a1a1a` 描边（同 `CHEST_ART` 色板）。
7. **关闭 ✕**：5×5 两条对角线共 9 像素，`#464546`；宁小勿大。
8. **翻页 ←/→**：块状白箭头 9×7（chevron 头 7px 宽 + 3px 杆），右下 1px `#1c1c1c` 落影；深底白、浅底 `#464546`。
9. **心形**：9×9 三色（§3.1 配方原样）；16×16 画布放 x3..y3 起。批量出现在血条语境时用 7px 简化版亦可，但三色关系（左上亮/右下暗）不可丢。
10. **音量**：喇叭梯形（左 3px 宽）+ 两道同心声波弧 1px；白或 `#464546` + 右下落影。
11. **整理**：三枚 3×3 小方块（沿对角线排）+ 尾端一枚落入 5×4 格槽（槽线 1px）——"归拢入格"语义，避开扫帚/垃圾桶。
12. **熔炉火**：梯形焰——外层 `#d84c45` 1px、焰身 `#ffb600`、焰心 `#ffff1f` 2×3；底 2px 暗色收平。
13. **页签**：梯形 10×6（顶 6 底 10），选中亮 `#a3a8b0`/未选暗 `#5c6169`，边 1px `#1a1a1a`；类别图标复用 `iconOf`（📦→`chest`、⛏️→`pick_wood`）。
14. **疾跑（预留）**：» 双 chevron，前 3×5 后 4×6，黑。
15. **选中框（hotbar）**：约 2px 均匀粗框 + 四角 3×3 加重块（四角加重为我方附加设计，便于儿童定位），`#ffd83d`（我方暖黄，有意偏离官方淡绿白——理由见 §1 与 §6）。

### 5.2 管线落位建议（供后续 plan 文档展开）

按钮图标建议进像素图标工坊新开的 `BUTTON_PIX` 数据表（键如 `btn_jump/btn_down/btn_cam/btn_act/btn_pause/btn_bag/btn_close/btn_page_l/btn_page_r/btn_heart/btn_vol/btn_sort/btn_flame/btn_tab`），出口 `buttonIcon(key)` 与 `iconOf` 同管线（16×16 → 64×64 → dataURL）；触屏钮/面板钮/页签统一替换，aria-label 保留中文语义。

---

## 6. 版权边界说明

1. **官方资产归属**：bedrock-samples 是 Mojang 官方样本仓，但其 GitHub license 字段为 `NOASSERTION`（"Other"，非开源授权，https://api.github.com/repos/Mojang/bedrock-samples ）——仓库供 Add-On 开发参考，贴图版权仍归 Mojang/Microsoft。minecraft.net 使用指南对"资产"的定义原文：*"Our assets, we mean the code, software, graphics, textures, images, models, sounds and other audio from any of our games…"*（https://www.minecraft.net/en-us/usage-guidelines ）——**直接取用/再分发官方贴图（含改色）超出该口径**。
2. **不受保护的部分（我们取用的）**：尺寸与状态机（22×22、四态）、光照方向惯例（左上亮右下暗）、语义符号学（跳跃=上箭头、攻击=剑、视角=立方体、»=疾跑）、"图标居中圆角方钮"的布局范式——这些是方法与风格语言，属思想/事实层面。
3. **受保护的部分（我们不碰的）**：Mojang 的具体像素排布（每一张贴图的字符画本身）。因此：
   - 我方全部按钮图标在 **16×16 字符画网格**上重画（官方触控钮为 22×22/16×16 面内图形，网格天然不同）；
   - 色板锚定我方既有体系（`PIX_TIER`/`PIX_HANDLE`/icons.js 各 map），仅在与语义强绑定处（心形红、火焰橙黄）取"同类不同值"；
   - 选中框等有意偏离官方色相（淡绿白 → 我方暖黄）；
   - 本报告中的像素描述是考据记录，不进代码库；不拷贝任何官方 PNG 进仓、不做官方贴图的资源映射/材质包兼容。
4. **既有口径一致性**：与 GLOSSARY.md 像素图标工坊词条"参考 MC 观感语言、全部程序自绘、零外部素材"及 icons.js 头注释"版权口径 D13"完全一致——本报告把该口径从物品图标扩展到按钮图标。

---

## 7. 来源清单与方法论

### 7.1 来源

| # | 来源 | 类型 | URL |
|---|---|---|---|
| S1 | Mojang/bedrock-samples（官方 vanilla 资源包样本仓，main 分支）——`textures/gui/controls/`、`textures/gui/newgui/`、`textures/ui/` 目录与 raw 贴图 | **官方第一手** | https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/textures/gui/controls · …/gui/newgui · …/textures/ui |
| S2 | Minecraft Wiki — Bedrock Edition GUI, UI, and Ore UI textures（全文件名清单，含 HowToPlay 触控教学图） | Wiki | https://minecraft.wiki/w/Bedrock_Edition_GUI,_UI,_and_Ore_UI_textures |
| S3 | Minecraft Wiki — Java Edition GUI textures | Wiki | https://minecraft.wiki/w/Java_Edition_GUI_textures |
| S4 | InventivetalentDev/minecraft-assets（Java 官方资产社区镜像）1.20.1 `widgets.png`/`icons.png`/`container/furnace.png` | 官方资产镜像 | https://github.com/InventivetalentDev/minecraft-assets/tree/1.20.1 |
| S5 | Mojira MC-265021（Java 选中框 24×23 vs 基岩 24×24 溯源） | 官方 bug 库 | https://bugs.mojang.com/browse/MC-265021 |
| S6 | Minecraft Wiki — Category:Java Edition GUI textures（文件尺寸收录：Hotbar selection 24×23、Button 22×22、Close 16×16、Lit progress 14×14、心族 9×9） | Wiki | https://minecraft.wiki/w/Category:Java_Edition_GUI_textures |
| S7 | resourcepackcreator.com — Minecraft GUI Textures Explained（Java/基岩 GUI 文件→UI 映射、九宫格边车） | 社区工具站 | https://resourcepackcreator.com/guide/minecraft-gui-textures |
| S8 | minecraft.net — Usage Guidelines（"assets"定义原文） | **官方第一手** | https://www.minecraft.net/en-us/usage-guidelines |
| S9 | GitHub API — bedrock-samples 仓库元数据（license=NOASSERTION） | 元数据 | https://api.github.com/repos/Mojang/bedrock-samples |
| S10 | Minecraft Wiki API imageinfo（Heart (icon).png 9×9、Hotbar selection.png 24×23、Button.png 22×22、Close.png 16×16，2026-10-24 查询） | Wiki API | https://minecraft.wiki/api.php?action=query&titles=File:Hotbar_selection.png%7CFile:Heart.png%7CFile:Button.png%7CFile:Close.png%7CFile:Heart_(icon).png&prop=imageinfo&iiprop=url%7Csize&format=json |
| S11 | wiki 文件页 `Heart (texture) JE1 BE1.png`（JE/BE 同修订版命名佐证） | Wiki | https://minecraft.wiki/w/File:Heart_(texture)_JE1_BE1.png |
| S12 | 本仓 docs/mc-touch-controls-research.md（按钮语义/手势/版本时间线的既有权威） + 其所引 minecraft.net Controls 官方文 | 内部+官方 | https://www.minecraft.net/en-us/article/minecraft-controls |
| S13 | Minecraft Wiki — Category:Bedrock Edition GUI textures（基岩 GUI 文件尺寸收录：TabFront 12×10、Jump/D-pad 键族 22×22、LeftArrow 16×16 等） | Wiki | https://minecraft.wiki/w/Category:Bedrock_Edition_GUI_textures |

### 7.2 未能获取（如实说明）

- **minecraft.wiki 图片直链**（/images/*）：Cloudflare 人机盾拦截脚本下载，故 Java 原图改经 S4 镜像取样（结论不受影响，且镜像即官方资产本体）。
- **`textures/ui/` 个别文件**（store_sort_icon、box_exit、settings_pause_menu_icon、chat_down_arrow、cell_image、dialog_background_opaque）：下载失败或解码为空，未取样，不作依据；涉及结论（整理钮无官方对应）已按"缺位"表述。
- **Java `Close.png`/`Button.png` 像素级内容**：仅取得尺寸元数据（S6/S10），像素描述以基岩同族 newgui 件为准。

### 7.3 方法论（可复现）

对 S1/S4 的 PNG 用 PowerShell System.Drawing 逐像素解码：输出每文件 Top-N 色值（ARGB 十六进制+计数）与按色聚类的一字符一像素网格，再人工读形。取样脚本与输出存于 `%TEMP%\opencode\mc-tex\`（analyze.ps1 / g1..g11*.txt，会话级临时物，不入库）。取样日期 2026-10-24，对应 bedrock-samples main 与 minecraft-assets 1.20.1 当日快照；主分支随版本更新可能微调个别文件，核心配方（§2.2/§3）为多文件交叉一致，稳定。

---

## 8. 落地对照（实施记录，2026-10-24）

本报告当日落地为 **js/button-icons.js（按钮像素图标工坊）** + 触屏/面板/菜单全量替换。逐条对照 §1/§5 建议：

| 建议 | 落地 | 说明 |
|---|---|---|
| 跳跃=上箭头+地面线 / 下降=镜像（§1 S1） | ✅ `jump`/`down` | 地面线/顶线照建议；下降顶线即"镜像"口径 |
| 视角=立方体线框，不画相机（§1 S1） | ✅ `cam` | 等距立方体 1px 白线框（原眼睛方案已废） |
| 心形 9×9 三色无描边（§1 S4） | ✅ `heart` | #ff1313/#bb1313/#ffc8c8 原样；用在 mkHpBar 头顶血条（替代字体 ❤） |
| 背包=褐色箱形容器（§1 S1） | ✅ 委托 `chest` | 触屏背包键/宝物柜用 CHEST_ART 褐色系；面板内"背包"标签用 `grid`（槽位语义，避免与宝箱标题同图打架） |
| 整理=物品归槽，勿扫帚/垃圾桶（§5.1-11） | ✅ `sort` v2 | 三小方块落入三格槽位条（初版扫帚按本条建议废弃） |
| 关闭=9 像素紧凑 X，宁小勿大（§5.1-7） | ⚠️ 本地适配 | 保留大号白 X：我方面板 ✕ 是儿童可点击按钮（暗底半透明），粗白 glyph + 近黑描边是我方全局钮语言（§2.5 的"深底白"条款），命中区优先 |
| 白色实心块箭头+右下落影（§1 S1） | ✅ `left`/`right` | K 描边+右下 G 暗面=落影的描边版；左右由基画几何派生防手抖 |
| 按下=整钮下移 1px（§1 S1） | ✅ CSS | touch.css/style.css `:active` 加 `translateY(1px)` |
| 动作键镐剪影按钮版（§5.1-4） | ⚠️ 本地适配 | 委托 `itemIcon('pick_iron')` 彩色物品图：与快捷栏同观感（MC 物品在栏内就是彩色），图形单一来源不二画；下界攻击键同口径委托 `sword_iron` |
| 钮底 CSS 化 + 石色系（§5.0） | ➖ 暂缓 | 既有钮底（暗底半透明圆钮）是 2026-10-24 触屏拍板口径，本次只换图标不动钮底；石质钮底留待视觉迭代 |
| 图标进工坊数据表、aria 保留中文（§5.2） | ✅ | `BTN_PIX` + `btnIcon/btnImg` 出口（键名未用 btn_ 前缀：工坊本身即命名空间）；aria-label 全量保留 |

**新增防错网**：test/button-icons.test.js 扫 js/** 全部 `icon:'…'`/`btnImg('…')`/`btnGlyph('…','…')` 字面量 ⊆ 工坊键集（漏登记即红，audio-registry.test.js 同款口径）；字符画 16×16 形状与派生一致性一并断言。
