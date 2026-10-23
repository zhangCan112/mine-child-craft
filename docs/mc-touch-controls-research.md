# Minecraft 基岩版触控操作（Touch Controls）研究报告

> **用途**：为 my-craft-demo（6 岁儿童向类 Minecraft 体素游戏，iPad 浏览器）移动端按键控制系统重设计提供官方设计依据。
> **调研日期**：2026-10-23。所有结论均标注来源 URL；"新版触控"指 2022-11-29 起默认启用的重设计触控体系（1.19.50+），"经典触控"指此前以 D-pad 为核心的旧方案。
> **信息时效**：以本报告调研时抓取的页面原文为准；minecraft.wiki 为社区维护的权威整理站，关键版本结论均与 minecraft.net / feedback.minecraft.net 官方日志交叉核对。

---

## 1. 来源清单

| # | 来源 | 类型 | URL | 支撑的结论段落 |
|---|------|------|-----|----------------|
| S1 | Minecraft Wiki — Controls（Bedrock Edition § Touch） | Wiki（第二手，逐条标注官方版本史） | https://minecraft.wiki/w/Controls | §2 方案总览、§3 布局拆解、§5 手势表、§8 版本史 |
| S2 | Minecraft Wiki — Settings（Controls → Touch 标签页全表） | Wiki | https://minecraft.wiki/w/Settings | §3 各按钮默认值、§4 可自定义项清单 |
| S3 | minecraft.net —《Minecraft Controls》官方教学文章（含 Touch controls 章） | **官方第一手** | https://www.minecraft.net/en-us/article/minecraft-controls | §3 默认布局"首次启动加载的基础配置"权威描述 |
| S4 | minecraft.net —《1.19.50 Update Available on Bedrock》官方公告 | **官方第一手** | https://www.minecraft.net/en-us/article/1-19-50-update-available-bedrock | §2 新触控默认启用、三模式、教学视频、1.19.50 修复清单 |
| S5 | feedback.minecraft.net —《Minecraft Beta & Preview - 1.19.10.20》官方 changelog | **官方第一手** | https://feedback.minecraft.net/hc/en-us/articles/6465669193997 | §8 时间线（beta 期细节：连续跳、摇杆视觉） |
| S6 | feedback.minecraft.net —《Minecraft - 1.19.10 (Bedrock)》官方 changelog（经 Zendesk API 抓取全文） | **官方第一手** | https://feedback.minecraft.net/hc/en-us/articles/7463497138829 | §8 时间线（1.19.10 正式版触控修复） |
| S7 | Minecraft Wiki — Bedrock Edition 1.19.50 版本页 | Wiki | https://minecraft.wiki/w/Bedrock_Edition_1.19.50 | §2/§4（Control Mode 菜单、joystick 疾跑语义、400ms→点按） |
| S8 | Minecraft Wiki — Bedrock Edition Preview 1.19.40.20 版本页 | Wiki | https://minecraft.wiki/w/Bedrock_Edition_Preview_1.19.40.20 | §4（800ms 防误触、长按分堆、双击下降退出飞行、设置项改名） |
| S9 | Minecraft Wiki — Bedrock Edition Preview 1.19.50.20 / 1.19.50.21 版本页 | Wiki | https://minecraft.wiki/w/Bedrock_Edition_Preview_1.19.50.20 、https://minecraft.wiki/w/Bedrock_Edition_Preview_1.19.50.21 | §4（dwell time 180ms、动作延迟移除、auto-sprint 摇杆语义） |
| S10 | Minecraft Wiki — Bedrock Edition 1.20.30 版本页 | Wiki | https://minecraft.wiki/w/Bedrock_Edition_1.20.30 | §4（设置项合并/改名、Pause→Game menu、菜单图标更新） |
| S11 | Minecraft Wiki — Bedrock Edition Preview 1.19.10.20 版本页 | Wiki | https://minecraft.wiki/w/Bedrock_Edition_Preview_1.19.10.20 | §8 时间线、iOS/iPadOS 蓝牙键鼠 |
| S12 | Minecraft Wiki — Bedrock Edition 1.18.30/Development versions | Wiki | https://minecraft.wiki/w/Bedrock_Edition_1.18.30/Development_versions | §8 时间线（beta 期"Button Size"滑杆可调摇杆头大小） |
| S13 | Minecraft Wiki — Bedrock Edition 1.20.10 版本页 | Wiki | https://minecraft.wiki/w/Bedrock_Edition_1.20.10 | §6（GUI Scale Modifier / Extra Large UI 引入） |
| S14 | Minecraft Feedback 社区帖（佐证玩家痛点，非结论依据） | 社区 | https://feedback.minecraft.net/hc/en-us/community/posts/4681918652045-Updated-Touch-Controls-Feedback-Bedrock-Beta 、https://feedback.minecraft.net/hc/en-us/community/posts/20730960240781-Reintroduce-Split-control-for-new-touch-controls 、https://feedback.minecraft.net/hc/en-us/community/posts/360043415132--Bedrock-Improve-mobile-touchscreen-controls | §7 玩家痛点 |

**未能获取的来源（如实说明）**：

- **help.minecraft.net 帮助中心**：多次尝试 `websearch` 与直接抓取（含 Zendesk 搜索 API `…/api/v2/help_center/…/search.json`），该站为纯前端 SPA，搜索结果由 JS 渲染，服务端不返回文章列表；未检索到"Touch Controls"专题帮助文章原文。**fetch 不到，不作依据**。帮助中心内容以账号/安装/故障排查为主，玩法操作教学实际放在 minecraft.net 的 S3 文章。
- **minecraft.net/en-us/article/minecraft-1-20-30-update-now-available-bedrock**：直接 fetch 多次超时/传输失败（改用 execute 内 fetch 抓取了 S3/S4 两篇成功，此篇未成）；1.20.30 结论改以 S10（wiki 版本页，其参考文献指向官方 changelog）为准。

---

## 2. 官方触控方案总览（问题 A）

基岩版把输入分为三种控制模式（Keyboard & Mouse / Controller / Touch），检测到某类输入会自动切换到对应模式（S1）。触控内部有 **3 种官方"控制模式（Control Mode）"**，加上分离式控件（Split Controls）开关，共组合出 **4 种实际形态**（S1、S2、S4）：

| 模式 | 移动 | 视角 | 交互方式 | 备注 |
|------|------|------|----------|------|
| **Joystick & tap to interact**（摇杆 + 点按交互，**默认**） | 拖动左下摇杆 | 在其余任意区域拖动 | 直接**点按/长按世界中的方块与生物**（无准星） | 1.19.50 起新触控默认（S4）；S2 显示其为 Control mode 默认值 |
| **Joystick & aim crosshair**（摇杆 + 准星） | 拖动摇杆 | 拖动屏幕转准星 | **瞄准准星 + 屏幕按钮**（攻击按钮、交互按钮等 Action Buttons） | 面向进阶玩家；"Show action buttons"开关仅在此模式出现（S2） |
| **D-pad & tap to interact**（方向键 + 点按交互） | 点按屏幕方向箭头 | 在其余任意区域拖动 | 点按/长按方块 | 旧版经典操作的现代版；前进键双击疾跑（S1） |
| ↳ + **Split Controls**（分离式控件，仅 D-pad 模式可选） | 方向键 | 拖动 | 准星 + 按钮（等价"D-pad + 准星"） | S1、S2；1.19.50 曾从新触控中移除分离式控件后应社区要求恢复（S14） |

**关键版本划分**（详见 §8 时间线）：

- **经典触控（≤1.19.41 默认）**：D-pad 移动 + 分离式控件（准星+按钮）是老 Pocket Edition 玩家的习惯方案；"Split Control 选项只会出现在 Classic 控制模式中"（1.19.50 官方 changelog 原文，S4/S7）。
- **新版触控（beta 1.18.10.22 起 ~ 1.19.50 全面转正）**：以"摇杆 + 直接点按世界"为默认，辅以可选准星模式。**注意：新版触控的正式转正是 1.19.50（2022-11-29），而非任务提示中猜测的 1.20.30**；1.20.30（2023-09-19）只是后续迭代（触控设置项改名合并、菜单图标更新）（S4、S10）。

---

## 3. 默认布局逐项拆解（问题 B、D、E、F、G、H）

以下以**默认模式"Joystick & tap to interact"**为基准。官方 S3 文章明确写道："下面是**你首次启动游戏时加载的基础配置**（the basic configuration that loads when you first start the game）"。

### 3.1 移动摇杆（Joystick）

- **位置**：屏幕**左下角**（S3："The joypad in the bottom left of the screen"）。
- **固定 vs 跟随拇指**：由 "Lock Joystick"（锁定摇杆，beta 期名，S8 改名记录）决定——锁定时摇杆固定在默认位置；未锁定时摇杆**跟随拇指落点**出现。1.19.50 起"未锁定时的可拖动范围与锁定时一致"，且**自动疾跑**在"摇杆推到背景圈稍上方"时触发、拉回圈内即解除（S4、S7、S9）。
- **可见性**：设置项"Joystick visibility"（1.20.30 由 "Joystick Always Visible"/"Joystick Visible When Unused" 两开关合并为下拉菜单，S10），**默认 Always visible（始终可见）**（S2）。
- 推杆到顶 = 疾跑（需开启摇杆疾跑类开关，见 3.5）（S1）。

### 3.2 跳跃键（Jump）

- **位置**：**屏幕右侧**、标有**向上箭头**的按钮（S3）。
- **按住可持续跳跃**（1.19.10 起，MCPE-117045，S5/S6）。
- **游泳时**变为"上浮（Water Ascend）"按钮（S1）。
- **创造模式双击该按钮 = 进入飞行**；进入飞行后该按钮变为"Flying Ascend（上升）"，**按住持续上升**；**双击上升按钮 = 结束飞行**（S1、S3）。

### 3.3 潜行键（Sneak）

- **位置**：右侧、标有**向下箭头**的按钮（S3）。
- 默认行为是**"点按一次切换（toggle）"**——S2 设置项 "Sneak button behaviour" 默认值 "Tap button once"，可改为按住才潜行；wiki 按钮表描述为"双击切换、再双击恢复"（S1，两处描述均指向"非长按持锁"的切换语义）。
- **游泳时**变为"下潜（Water Descend）"；**飞行时**变为"Flying Descend（下降）"；**双击下降按钮 = 取消飞行**（1.19.50 起统一为此语义，之前快速连点升降会误取消飞行，S1、S4）。
- 潜行状态下方块边缘不会走落（防摔崖）（S3）。

### 3.4 飞行相关按钮（Fly Up / Fly Down）

**没有独立的"飞行模式按钮"**。官方语义全部复用跳跃/潜行两键（S1、S3）：

| 状态 | 右侧上箭头键 | 右侧下箭头键 |
|------|--------------|--------------|
| 地面 | 跳跃（按住连跳） | 潜行（点按切换） |
| 创造双击跳跃后（飞行） | Flying Ascend：按住上升，**双击退出飞行** | Flying Descend：按住下降，**双击退出飞行** |
| 水中 | Water Ascend 上浮 | Water Descend 下潜 |

### 3.5 疾跑（Sprint）

三种触发路径，按模式与设置不同而生效（S1、S2）：

1. **专门按钮**：右侧"双箭头"按钮开启疾跑模式（S3）；仅摇杆模式显示；开启"Easy sprint"（beta 期名 Auto Sprint / "Sprint using the joystick"）后**该按钮消失**（S1、S2、S8）。
2. **摇杆推满**："Easy sprint"设置：*把摇杆完全推向前即疾跑，无需按钮*（S2 原文 "sprint when the joystick is fully pressed. No buttons required"）；摇杆未锁定时推到背景圈稍上方即触发（S4/S7）。
3. **D-pad 模式**：**双击前进键**疾跑（饥饿过高除外）；飞行中双击前进 = 加速飞行；水下双击前进 = 游泳（S1）。

### 3.6 视角控制（问题 D）

- **区域：全屏（除摇杆与 HUD 外的任意区域）拖动**即转视角——三种模式的官方描述均为 "**Drag anywhere else to look around**"（S1、S2），**不是**"仅右半屏"。
- 视角与按键**可同时工作**：1.19.50 官方修复项 "Improved the way that button presses and camera movements work in tandem in the new Touch Controls"（S4），说明按住按钮的同时拖动视角是官方明确支持的组合操作。
- 配套设置：**Camera sensitivity（触屏灵敏度滑杆，默认 50）**、Invert camera Y-axis（Y 轴反转，默认关）、Spyglass damping（望远镜阻尼，默认 50）（S2）。
- **双指/捏合手势：官方游戏内视角控制未使用双指手势**——在 S1/S2/S3/S4 全部触控文档中均无 pinch 缩放视角的记载（捏合仅存在于菜单/地图缩放等 UI 场景，不属于本报告抓取范围）。如需此结论的反例需另行考证。

### 3.7 快捷栏与背包（问题 E）

- **选中物品**：**点按快捷栏槽位**（S3："you can tap to select which one you're holding"）。
- **打开背包**：点按**快捷栏最右端的 "…" 按钮**，进入背包+合成一体的 Pocket UI 界面；顶部有"Craftable/All（可合成/全部）"切换开关；右上角 X 关闭返回游戏（S3）。
- **丢弃物品**：**长按快捷栏槽位约 2 秒**丢出整组（wiki 标注[verify]；S1）；官方 S3 教学同样写"tap it in your hotbar and hold for a couple of seconds"。
- 背包内：**长按物品堆**弹出数量进度条左右拖动分堆；**点按物品堆后滑过多个空格**均分；**双击物品堆**合并同类（S1）。触屏背包滚动有 180ms"dwell time"（按住多久才算拖动而非滚动，1.19.50 由 120ms 调至 180ms，S4/S9）。
- Nintendo Switch 之外的所有触屏设备均可触控快捷栏/背包；另存在 "Touch input for hotbar only"（仅快捷栏响应触摸，配合手柄用）开关（S1、S2）。

### 3.8 暂停/菜单按钮（问题 G）

- **位置：无论哪种触控模式，菜单类按钮永远在屏幕顶部一行**（S1 原文 "Menu buttons always appear on the top of the screen regardless of touch control mode"）。
- 组成：**暂停按钮（菜单）**、**聊天按钮（顶部带对话气泡图标的按钮）**、**表情按钮（顶部居中）**；可选开启"视角切换按钮"（1.21.70 加入，触控设置中开启）（S1、S3）。
- 点暂停按钮进入菜单，菜单中点 "**Resume Game**" 返回（S3）。1.20.30 起"Pause menu"官方更名 "**Game menu**"（S10）。
- 顶部一排按钮的**尺寸**可三档调节（Top button size：Small/Medium/Big，默认 Small）（S2）。

### 3.9 挖掘与放置手势（问题 H）

默认（点按交互类模式，无准星）——**作用于手指按住的位置**：

- **挖掘 = 手指按住目标方块不动**；耗时以屏幕上的 **24 边形（icositetragonal）进度图形**显示，随工具不同而变化（S1）。官方教学："Tap and hold on the tree's trunk to start punching it"（S3）。
- **放置 = 点按目标表面**（手持方块时）（S1、S3）。
- **攻击生物 = 点按**（S3："tap the screen to attack"）。
- **使用方块（按钮/箱子/工作台）= 点按**（S3）。
- 分离式/准星模式下：**先把准星对准目标，再点按屏幕任意处（HUD 除外）放置/使用、按住任意处挖掘**（S1）。
- **防误触（创造模式）**：关闭动作按钮时，**破坏第一个方块有 800ms 起始延迟**"降低误拆概率"（1.19.40.20 引入，S8）；对应设置 "Delayed block breaking (Creative mode only)" **默认开启**（S2）。
- **攻击/交互按钮无动作延迟**：1.19.50 明确"Removed the action delay from Attack and Interact buttons"（MCPE-158143）（S4、S7）。
- **情境交互按钮（Interact button）**：喂食/骑乘/上船/拴绳/剪毛等动作以**文字按钮形式浮现在快捷栏上方**，点按按钮或长按目标均可触发（S1 完整列表：Ignite/Feed/Ride/Board/Saddle/Milk/Shear/Leash… 共 20+ 种）。
- **装填完毕的弩**：点按即射（旧版需长按 400ms，1.19.50 改掉）（S4）。

---

## 4. 新版触控设计理念与可自定义项（问题 C）

### 4.1 设计理念（从官方 changelog 演进归纳，每条注明出处）

1. **直接触摸世界优先**：新默认方案"摇杆 + 点按交互"把"看哪点哪"作为主交互，准星模式降级为进阶选项（S1、S4）。
2. **首次引导**：1.19.50 加入 **Touch Controls Video Onboarding**——设置内有触控教学视频，**从未用过新触控的玩家首次进世界时自动播放**（S4）。
3. **防儿童式误操作**：创造模式首块 800ms 破坏延迟 + "Delayed block breaking"默认开（S2、S8）；潜行防坠崖（S3）；auto-jump 开启时会自动跃出水面爬上陆地方块（S8）。
4. **响应即时化**：移除攻击/交互按钮动作延迟；弩由 400ms 长按改为点按即发；按住跳跃键连续跳（S4、S5/S6）。
5. **触觉反馈**：拆方块/分物品时设备振动（Vibrate when destroying blocks / splitting items，**均默认开启**）（S2）。
6. **可发现性**：攻击/交互等按钮仅进阶模式显示；拾取方块按钮（1.21.50，默认关）、视角切换按钮（1.21.70，默认关）默认隐藏、按需开启（S1、S2）。
7. **全员可及**：左撇子模式镜像全部按钮；GUI 缩放；超大 UI；状态图标适配安全区并单行排布（S2、S4）。
8. **按钮与视角并行**、摇杆跟手范围与疾跑解除区明确化（S4）。

### 4.2 可自定义项清单（S2「Settings → Touch」全表 + S1）

| 自定义项 | 形态 | 默认 | 说明 |
|----------|------|------|------|
| **Customize controls（自定义控件）** | 入口按钮 | — | **在游戏内（已进入世界）**打开编辑器，可逐个调整按钮的**位置、大小、透明度**（S1："All control buttons and the joystick can be customized in location, size, and opacity"；S2："position, opacity, and size of individual buttons"） |
| Control mode | 下拉 | Joystick & tap to interact | 三选一（§2） |
| Show action buttons | 开关 | 开 | 仅准星模式；显示攻击/交互等按钮 |
| Left-handed inventory access（左撇子） | 开关 | 关 | **镜像 HUD 上全部按钮与物件**（含背包入口移到快捷栏左侧） |
| Joystick visibility | 下拉 | Always visible | 始终可见/使用时可见/隐藏 |
| Invert camera Y-axis | 开关 | 关 | |
| Camera sensitivity | 滑杆 | 50 | |
| Pick block | 开关 | 关 | 1.21.50 加入，创造模式取方块 |
| Camera perspective button | 开关 | 关 | 1.21.70 加入，切换第一/第三人称 |
| Auto jump | 开关 | **移动端默认开** | 走向方块自动跳上一格（S2 明确区分 Windows/主机默认关、Mobile 默认开） |
| Easy sprint | 开关 | 关 | 摇杆推满即疾跑、疾跑按钮随之隐藏 |
| Top button size | 三档 | Small | 顶部菜单/聊天/表情按钮尺寸 |
| Sneak button behaviour | 二选一 | **Tap button once** | 点按切换 vs 按住潜行 |
| Delayed block breaking (Creative only) | 开关 | **开** | 创造模式慢速起破防误拆 |
| Vibrate when breaking / splitting | 开关×2 | **开** | 触觉反馈 |
| Outline selection | 开关 | 开 | 准星模式下给目标方块加彩色描边 |
| Touch input for hotbar only | 开关 | 关 | 触摸仅作用于快捷栏 |
| Split controls | 开关 | 关 | 仅 D-pad 模式可用；加准星 |

> 命名沿革：beta 期 "Sprint On Movement→Auto Sprint""Static Joystick→Lock Joystick""Toggle Crouch→Crouch Toggle"（S8）；1.20.30 两摇杆可见性开关合并为下拉、"Lefty→Left hand mode"（S10）。
> 摇杆大小调节最早以"Button Size 滑杆"形式出现在 1.18.30 开发版（S12）；**逐按钮位置/大小/透明度的完整自定义器的确切引入版本未能在本次抓取的官方 changelog 中定位到**（S1/S2 只记载了现状）——此处如实存疑。

---

## 5. 手势语义表（问题 B/C/D/E/H 汇总）

以默认模式（Joystick & tap to interact）为准（S1、S3）：

| 手势 | 作用对象 | 触发结果 |
|------|----------|----------|
| **点按（tap）** | 世界中的表面 | 放置手中方块 |
| 点按 | 生物 | 攻击 |
| 点按 | 可交互方块（门/箱子/工作台…） | 使用/打开 |
| 点按 | 快捷栏槽位 | 选中该物品 |
| 点按 | "…"（快捷栏最右） | 打开背包+合成界面 |
| 点按 | 顶部按钮 | 菜单 / 聊天 / 表情（视角按钮可选） |
| 点按（已装填弩） | 任意处 | 立即发射（1.19.50 前 400ms 长按） |
| **长按（hold）** | 目标方块 | 持续挖掘，屏幕出现 24 边形进度图形；创造模式首块有 800ms 防误触延迟 |
| 长按 | 快捷栏槽位 ≈2s | 丢弃整组物品 |
| 长按 | 背包内物品堆 | 弹出分堆进度条 |
| 长按 | 情境目标（动物/船/矿车…） | 等价于点按快捷栏上方弹出的 Feed/Ride/Board 等情境按钮 |
| **拖动（drag）** | 摇杆区域 | 移动；推满/推出圈外（视设置）触发疾跑 |
| 拖动 | 其余任意区域 | 旋转视角（与按住按钮可同时进行） |
| 拖动 | 背包内物品（180ms dwell 后） | 拿起物品拖放 |
| 点按+滑动 | 物品堆 → 多个空槽 | 均分堆叠 |
| **双击（double-tap）** | 跳跃键（创造） | 进入/退出飞行 |
| 双击 | 上升/下降键（飞行中） | 退出飞行 |
| 双击 | 前进键（D-pad 模式） | 疾跑/水中游泳 |
| 双击 | 背包内物品堆 | 合并同类散堆 |
| **双指（pinch 等）** | 游戏内视角 | **官方无此手势**（未见于任何抓取来源） |

准星类模式（Joystick & aim crosshair / D-pad + Split）差异：挖掘/放置作用于**准星指向处**，手势落在**屏幕任意非 HUD 区域**；攻击/放置由屏幕按钮承担（S1）。

---

## 6. 对儿童体素游戏（my-craft-demo，iPad 浏览器）的适配建议

每条建议标注所参考的官方设计及其来源。

| # | 建议 | 参考的官方设计 | 来源 |
|---|------|----------------|------|
| 1 | **主交互模型采用"直接点按世界"（tap to interact），不做强制准星**：点哪放哪、按哪挖哪，儿童无需理解"准星-屏幕分离"概念 | 新触控默认模式即为 Joystick & tap to interact；官方教学以点按/长按树干为第一课 | S1、S3、S4 |
| 2 | **移动用左下虚拟摇杆，且不锁定（跟手出现）**；摇杆始终可见 | 官方默认布局；Lock Joystick 关闭时跟手；visibility 默认 Always visible | S2、S3、S4 |
| 3 | **跳跃键放右侧拇指区，按住连续跳**；双击跳跃进入飞行；飞行中同键变"上升"、潜行键变"下降"，双击任一退出飞行 | 官方按钮状态机（Jump↔Flying Ascend；Sneak↔Flying Descend） | S1、S3 |
| 4 | **潜行采用"点按一次切换"而非按住**，并保留防坠崖语义 | 官方默认 "Sneak button behaviour: Tap button once"；潜行不落崖 | S2、S3 |
| 5 | **疾跑给显式按钮**（双箭头图标），不做"摇杆推满"隐式触发（儿童发现性差）；进阶再提供 easy-sprint 式选项 | 疾跑按钮为摇杆模式默认显示；Easy sprint 是可选关闭项（默认关） | S1、S2、S3 |
| 6 | **Auto-jump 默认开启**（走向方块自动跳上一格） | 移动端官方默认即开启，且开启时自动跃出水面 | S2、S8 |
| 7 | **挖掘必须按住目标处并显示环形进度**（官方为 24 边形），创造/低难度模式可加**首块 800ms 防误触延迟** | Break Block 手势 + Creative 800ms delay + Delayed block breaking 默认开 | S1、S2、S8 |
| 8 | **丢弃物品慎用长按快捷栏**（官方 ~2 秒丢整组）——儿童游戏建议移除或加确认弹窗，防止误丢 | Drop item 长按 2s 丢整组（官方亦知其风险，教学专门警告战斗中勿触发） | S1、S3 |
| 9 | **情境交互用"快捷栏上方弹出的文字/图标按钮"**（喂食/骑乘等），比长按更可发现 | Interact button 体系（Feed/Ride/Board 等 20+ 情境按钮浮于快捷栏上方） | S1 |
| 10 | **背包入口 = 快捷栏最右的 "…" 按钮**，背包与合成一体（Pocket UI），关闭键在右上角 X | 官方默认布局 | S3 |
| 11 | **菜单类按钮固定屏幕顶部一行**（暂停/其他），尺寸提供 Small/Medium/Big 三档 | Menu buttons always on top；Top button size 三档 | S1、S2 |
| 12 | **视角 = 除摇杆和 HUD 外全屏拖动**，提供灵敏度滑杆与 Y 轴反转；**保证"按住按钮+拖视角"可并行** | Drag anywhere else to look around；button presses and camera movements in tandem 修复项 | S1、S2、S4 |
| 13 | **不做游戏内双指手势**（官方未用 pinch 控制视角），保持单指+另一拇指按钮的双手分工 | 全部触控文档无双指视角记载 | S1–S4 |
| 14 | **挖掘/破坏给触觉反馈**（navigator.vibrate，iPad 上 Safari 不支持则降级为视觉/音频强调） | Vibrate when breaking blocks 默认开 | S2 |
| 15 | **提供逐按钮的位置/大小/透明度自定义 + 左手模式镜像**（即使是简化版：大/中/小按钮） | Customize controls 编辑器；Left-handed 镜像全部按钮 | S1、S2 |
| 16 | **首次进入世界播放/展示触控教学**（30 秒交互式引导优于视频） | Touch Controls Video Onboarding，首次自动播放 | S4 |
| 17 | **iPad 大屏适配**：按钮不必等比放大，保持拇指弧区（底部两角）；提供 GUI 缩放（小档位仅高分屏可用）与"超大 UI"选项 | GUI Scale Modifier（1.20.10 加入）、Extra Large UI；顶部按钮独立三档尺寸 | S2、S13 |
| 18 | **状态图标贴安全区、单行横排**（避开 iPad 刘海/圆角 Home 条） | Status icons follow the screen safe zone / form one row | S4 |
| 19 | 若面向家长提供"仅配合手柄用的触屏快捷栏"等辅助开关，可参考 "Touch input for hotbar only" | 同名官方设置 | S2 |
| 20 | 若未来加准星模式（精细建造），**把它做成可选模式而非默认**，并配 Outline selection 式目标描边 | 准星为可选模式；Outline selection 仅准星模式 | S1、S2 |

**iPad 专项说明（问题 F）**：官方将 iOS 与 iPadOS 列为独立发布平台（S7/S10 版本信息），并在 1.19.10 为 iOS/iPadOS 加入蓝牙键鼠支持（S6、S11）；但**未在任何抓取来源中发现"iPad 专属按钮布局"的官方文档**——大屏适配是通过 GUI Scale Modifier、Extra Large UI、Top button size 等通用选项实现的，而非独立布局。建议本项目同样以"同一布局 + 缩放选项"覆盖 iPad。（如实说明：此为"未找到"，非"官方明确没有"。）

---

## 7. 社区痛点佐证（仅作背景，结论以上述官方来源为准）

来自 Minecraft Feedback（官方反馈平台）触控主题讨论（S14）：

- **误触与按钮保持**：新触控 beta 期玩家反映"手指从按钮滑出会导致转屏"，希望按钮有按压捕获——后官方以"button presses and camera movements in tandem"修复方向回应（S4、S14）。
- **分离式控件之争**：1.19.50 将 Split controls 从新触控移除引发老玩家请愿（"Reintroduce Split control for new touch controls"帖），后该能力以 D-pad 模式专属开关回归（S2、S14）——提示：**触控方案没有唯一正确解，保留模式切换是官方最终选择**。
- **疾跑/瞄准请求**："被追击时难以边转视角边瞄准，希望 D-pad 改摇杆、单点潜行、专门疾跑键"（S14）——这些恰是新版触控后来落地的特性（摇杆默认、点按切换潜行、疾跑按钮）（S1–S4）。
- **自定义诉求**：beta 期大量"每个按钮可调大小/位置/透明度"的请求，最终以 Customize controls 编辑器落地（S1、S2、S14）。

对儿童游戏的启示：官方在"易上手（点按交互默认）"与"老玩家习惯（D-pad/准星模式保留）"之间采取**多预设 + 可自定义**策略，而不是单方案强制迁移。

---

## 8. 附：新版触控版本时间线（均可在 S1 History 段与 S5–S12 交叉验证）

| 版本（日期） | 触控相关事件 |
|--------------|--------------|
| v0.1.1（2011，PE Alpha） | 触屏设备加入 D-pad（经典触控起点）（S1 History） |
| v0.3.0 | 加入暂停按钮（S1 History） |
| v0.9.0 build 1 | 加入 interact（情境交互）按钮（S1 History） |
| v0.12.1 | 按钮分区布局、加入潜行按钮（S1 History） |
| beta 1.18.10.22 ~ 1.18.30 开发版（2022 上半年） | **新版触控进入 Beta/Preview 通道**（社区与 wiki 开发版页佐证；摇杆大小可经 Button Size 滑杆调整）（S12、S14） |
| Preview 1.18.30.23 | 为"准星+触摸"模式加入一批新按钮素材（摇杆/攻击/飞行升降/交互/骑乘等）（S1 History） |
| 1.19.10 / Preview 1.19.10.20（2022-05~07） | 按住跳跃键连续跳（MCPE-117045）；脚手架顶部可下移（MCPE-154309）；摇杆视觉更新；iOS/iPadOS 蓝牙键鼠（S5、S6、S11） |
| Preview 1.19.40.20（2022-09-08） | 设置加入 **Control Mode** 菜单（三模式）；创造首块 800ms 防误触延迟；触屏背包拖放/长按分堆；**双击下降退出飞行**；大量触控设置改名（S8） |
| **1.19.50（2022-11-29）** | **新版触控对所有触屏设备默认启用、不再挂实验开关**；三模式可选；Touch Controls Video Onboarding；移除攻击/交互按钮动作延迟；摇杆未锁定时拖动范围对齐+自动疾跑边界；弩点按即发；背包 dwell time 180ms（S4、S7、S9） |
| 1.20.10（2023-07-11） | 加入 GUI Scale Modifier、Extra Large GUI Scaling（大屏/低视力适配基础）（S13） |
| 1.20.30（2023-09-19） | 触控菜单 HUD 图标更新；"Joystick Always Visible/Visible When Unused"合并为 "Joystick Visibility Option"；"Sneak Toggle"→"Sneak"；"Lefty"→"Left hand mode"；Pause menu 更名 **Game menu**（S1 History、S10） |
| 1.21.50（Preview 1.21.50.26） | 加入 **pick block 按钮**（创造模式、触控设置中默认关闭）（S1 History） |
| 1.21.70（Preview 1.21.70.25） | 加入**视角切换按钮**（触控设置中开启）（S1 History） |

---

## 9. 参考文献列表

**官方（minecraft.net / feedback.minecraft.net）**

1. Minecraft Controls（官方控制教学，含 Touch controls 章）— https://www.minecraft.net/en-us/article/minecraft-controls
2. 1.19.50 Update Available on Bedrock（新触控默认启用公告 + 官方 changelog 全文）— https://www.minecraft.net/en-us/article/1-19-50-update-available-bedrock
3. Minecraft Beta & Preview - 1.19.10.20 — https://feedback.minecraft.net/hc/en-us/articles/6465669193997
4. Minecraft - 1.19.10 (Bedrock) — https://feedback.minecraft.net/hc/en-us/articles/7463497138829
5. （未抓取成功）Minecraft 1.20.30 Update Now Available on Bedrock — https://www.minecraft.net/en-us/article/minecraft-1-20-30-update-now-available-bedrock

**Minecraft Wiki（社区权威整理，含逐版本官方 changelog 摘录）**

6. Controls（Bedrock Edition § Touch）— https://minecraft.wiki/w/Controls
7. Settings（Controls → Touch）— https://minecraft.wiki/w/Settings
8. Bedrock Edition 1.19.50 — https://minecraft.wiki/w/Bedrock_Edition_1.19.50
9. Bedrock Edition Preview 1.19.40.20 — https://minecraft.wiki/w/Bedrock_Edition_Preview_1.19.40.20
10. Bedrock Edition Preview 1.19.50.20 — https://minecraft.wiki/w/Bedrock_Edition_Preview_1.19.50.20
11. Bedrock Edition Preview 1.19.50.21 — https://minecraft.wiki/w/Bedrock_Edition_Preview_1.19.50.21
12. Bedrock Edition Preview 1.19.10.20 — https://minecraft.wiki/w/Bedrock_Edition_Preview_1.19.10.20
13. Bedrock Edition 1.20.30 — https://minecraft.wiki/w/Bedrock_Edition_1.20.30
14. Bedrock Edition 1.20.10 — https://minecraft.wiki/w/Bedrock_Edition_1.20.10
15. Bedrock Edition 1.18.30/Development versions — https://minecraft.wiki/w/Bedrock_Edition_1.18.30/Development_versions

**社区佐证（Minecraft Feedback）**

16. Updated Touch Controls Feedback [Bedrock Beta] — https://feedback.minecraft.net/hc/en-us/community/posts/4681918652045-Updated-Touch-Controls-Feedback-Bedrock-Beta
17. Reintroduce Split control for new touch controls — https://feedback.minecraft.net/hc/en-us/community/posts/20730960240781-Reintroduce-Split-control-for-new-touch-controls
18. [Bedrock] Improve mobile touchscreen controls — https://feedback.minecraft.net/hc/en-us/community/posts/360043415132--Bedrock-Improve-mobile-touchscreen-controls
