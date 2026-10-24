# Minecraft「手持物品 → 主动作分派」官方语义研究报告

> **用途**：为 my-craft-demo ⛏️ 主动作键改「手持感知」（手持可放置方块=放置，空手/工具/不可放置物=挖掘/攻击）提供 Minecraft 官方语义依据。基岩版（触控）为主、Java 版作语义对照。
> **调研日期**：2026-10-24。信息时效：以当日抓取的 minecraft.wiki 现行页面与 minecraft.net 现行文章原文为准；基岩现行稳定线为 1.21.12x（wiki 页面已出现 26.x 年份制版本标记），Java 已进入 26.x 快照线。本报告涉及的行为（左右键分派、吃、TNT、挖掘节奏）均为多年稳定语义，抓取页面中无 2025–2026 变更记录。
> **与上一轮调研的关系**：不重复基岩触控布局/手势总览（见 [mc-touch-controls-research.md](mc-touch-controls-research.md)，下称**前序调研**，其来源编号 S1–S14）；本文专攻「手持 × 目标 → 动作」的分派规则，必要时交叉引用前序调研结论。

---

## 1. 来源清单

| # | 来源 | 类型 | URL | 支撑的结论 |
|---|------|------|-----|-----------|
| S1 | minecraft.net —《Minecraft Controls》官方教学（含 Mouse/Keyboard、Gamepad、Touch 三章，2026-10 现行版） | **官方第一手** | https://www.minecraft.net/en-us/article/minecraft-controls | Q1、Q2、Q5、Q6、Q8、Q9 |
| S2 | minecraft.net —《1.19.50 Update Available on Bedrock》官方公告（新触控默认启用 + 官方 changelog） | **官方第一手** | https://www.minecraft.net/en-us/article/1-19-50-update-available-bedrock | Q3、Q4、Q8（前序调研 S4 同源） |
| S3 | minecraft.net —《How to Speed Bridge!》官方文章（连发放置/搭桥技法；en-us 路径 404，da-dk 语言版为现行可抓取版本） | **官方第一手** | https://www.minecraft.net/da-dk/article/how-speed-bridge- | Q3 |
| S4 | Mojira（Mojang 官方 bug 追踪器）— MCPE-26819 | **官方第一手**（bug 记录） | https://bugs.mojang.com/browse/MCPE/issues/MCPE-26819 | Q3（按住放置键跨方块边界即时连放） |
| S5 | Minecraft Wiki — Controls（Java 键位表 + 基岩 K&M/手柄/触控全表） | Wiki | https://minecraft.wiki/w/Controls | Q1、Q2、Q5、Q6、Q8、Q9 |
| S6 | Minecraft Wiki — Settings（基岩 Touch 设置现行全表） | Wiki | https://minecraft.wiki/w/Settings | Q4、Q8（前序调研 S2 同源更新版） |
| S7 | Minecraft Wiki — Breaking（挖掘机制正文） | Wiki | https://minecraft.wiki/w/Breaking | Q1、Q4、Q6 |
| S8 | Minecraft Wiki — Food（进食机制正文） | Wiki | https://minecraft.wiki/w/Food | Q5 |
| S9 | Minecraft Wiki — TNT（方块页：硬度/点燃途径/方块状态/历史） | Wiki | https://minecraft.wiki/w/TNT | Q7 |
| S10 | Minecraft Wiki — Sneaking（潜行效果正文） | Wiki | https://minecraft.wiki/w/Sneaking | Q2 |
| S11 | Minecraft Wiki — Tutorial:Bridging（搭桥教程；页面自带 work in progress 标记，权威度低于主命名空间页，仅作旁证） | Wiki（教程页） | https://minecraft.wiki/w/Tutorial:Bridging | Q3 |

**未能获取/未能查实（如实说明）**：

- **help.minecraft.net**：纯前端 SPA，抓不到（前序调研已确认，本轮未重试）。
- **「触控短 tap（空手/工具）点普通方块」的单击效果**：S1/S5/S7 均只记载「长按才破坏」，无一处明文写短 tap 会/不会造成单击破坏进度或挥拳动画（详见 Q1 存疑注）。
- **Java 按住右键连放的精确节拍**（通行说法 4 game ticks = 0.2s）：未在抓取页面找到明文，只能证明「按住=连发」行为本身（详见 Q3）。
- **基岩触控 tap-to-interact 手持方块「按住表面」的专门描述**：官方文档只写「tap 放置、长按=破坏」，无手持方块时长按表面的单句明文；连放结论由 K&M 语义 + S4/S3/S11 交叉推得（详见 Q3 推断链）。
- **minecraft.wiki 直连抓取不稳定**：本轮多次遇到 Cloudflare 403/传输中断，同一 URL 重试可成；所有引用均来自最终成功抓取的原文。

---

## 2. 逐问求证

### Q1. tap 语义随手持物变化的官方证据

**结论**：
1. 基岩触控（tap-to-interact）下，**手持方块 tap 方块表面 = 放置**（官方、Wiki 双源一致）。
2. **tap 生物 = 攻击（单击伤害），与手持物无关**——手持木方块、剑、镐 tap 生物都是攻击，不是放置。
3. **空手/工具短 tap 普通方块：官方口径为「无实质操作」**——破坏必须**长按**才开始；破坏进度随松手立即重置，短 tap 即使瞬间累积进度也立即清零。攻击输入通道（Attack/Destroy）对生物是「单击」、对方块是「按住」，同一输入按**目标类型**分派。

**原文关键句**：

- 官方教学·触控章（S1）：
  - *"Once you're holding something in your hand, like a block of wood, sword or pickaxe, you can **tap the screen to attack things with it (including other creatures in the world)**, or **tap a surface to place whatever you're holding onto that surface**."*
    （手里拿着木方块、剑或镐时，tap 屏幕即可攻击目标（包括世界里的其他生物），或 tap 一个表面把手里的东西放到该表面上。）
  - *"**Tap and hold on the tree's trunk to start punching it.**"*（点住树干不放，开始徒手砍它。）——破坏入口是「点住」，不是单击。
  - *"To use objects in the world – like buttons, chests, crafting tables, and more – just **tap them**."*（使用世界里的对象——按钮、箱子、工作台等——tap 它们即可。）
- Wiki Controls 触控表（S5）：
  - *"Place Block | By default (split controls is disabled), **tap the desired area to place the block**."*
  - *"Break Block | **Hold finger down on the desired block to break.** How long it takes to break the block is indicated by an icositetragonal icon on the screen, varying on the tool being used to break it."*
- Wiki Breaking（S7）：
  - *"Breaking … is performed (by default) by holding Left Mouse Button or right trigger … or by **long-pressing on the block on touch screens**."*（触屏上靠长按方块完成。）
  - *"The progress for breaking a block is reset if the target block changes while breaking. **Progress is also reset whenever the breaking control is released.**"*（松手即重置破坏进度。）
- 官方教学·手柄章（S1，可作「攻击动作覆盖方块」的旁证）：
  - *"you can use the right trigger to **attack things with it (including blocks or other creatures in the world)**, or the left trigger to place …"*（右扳机可攻击的目标「包括方块或世界里的其他生物」。）

> **存疑注（如实说明）**：「短 tap 普通方块是否留下一次挥拳动画或单帧裂纹」未找到任何明文记载。上表「无实质操作」是从 S1/S7 的「破坏须长按 + 松手重置」推出的强结论：即便短暂累积了进度，松手瞬间归零，玩家感知上等于无操作。

**来源**：S1、S5、S7。

---

### Q2. 交互方块优先级（手持方块 tap 箱子/门/工作台/熔炉）

**结论**：**可交互方块优先于手持物的放置/使用**——手持方块 tap 箱子=开箱，不放置。**潜行状态下反转**：潜行 + use/tap = 使用手持物（放置）。Java 右键与基岩 tap 同规则，两版口径一致（Wiki 原文几乎逐字相同）。

**原文关键句**：

- Wiki Controls·Java 键位表 use 条目（S5）：
  - *"Commonly, **if both the item held and the block clicked on has a such purpose (like trying to place dirt on a chest), the block overrules the item**."*
    （通常手持物与所点方块都有用途时——比如拿着泥土点箱子——**方块胜过物品**。）
- Wiki Controls·基岩 K&M use 条目（S5）：
  - *"If both the item held and the faced block interactable, **the block overrules the item; that is, the player interacts with the block**."*
- Wiki Controls·基岩触控准星模式 Interact 按钮（S5，同句）：*"Places blocks, interact with blocks, entities, or items … If both the item held and the faced block interactable, the block overrules the item."*
- 潜行反转（S5）：
  - Java Sneak 条目：*"**Holding ⇧ Shift and pressing use on an usable block with a block in hand overrides the USE action and places the block instead.** For example, using a lever on a block that would usually open an internal inventory (such as a dispenser) places the lever instead."*
  - 基岩 K&M Sneak 条目：*"Holding ⇧ Shift and pressing use on an interactable block with a block in hand **overrides the use action and places the block instead**."*
- Wiki Sneaking（S10，交叉印证）：
  - *"**Pressing use prioritizes using a held item over interacting with a targeted block.** For example, this allows placing a hopper on a chest, a torch on a furnace, or redstone on a command block."*（潜行时按 use 优先使用手持物而非交互方块。）
  - 版本史：Java 1.4.6 (12w49a) *"The player can now place blocks, such as redstone dust or levers, **on interactable blocks while sneaking**."*——该规则 2012 年即定型。
- 触控下的潜行形态（S5/S10）：触控无 Shift，潜行=**双击潜行键切换**（*"sneaking is toggled by double-tapping [sneak button]"*）；潜行状态是引擎级状态，进入后 use/tap 分派即走「手持物优先」分支。

> **存疑注**：Wiki 无「触控模式潜行 + tap = 放置」的专门单句（规则句挂在 K&M Shift 与 Sneaking 通用效果下）；因基岩各输入共享同一 use 动作与潜行状态，判定触控同样生效，此为合理推导而非逐字明文。

**来源**：S1（tap them）、S5、S10。

---

### Q3. 放置的按住连发（关键问题）

**结论**：**会连发**。按住放置输入（Java 右键 / 基岩右键或 LT / 触控按住放置）期间，游戏持续放置方块——这正是「搭桥」（bridging）玩法的根基。**不存在「按住只放一次」的官方模式**。放置一次的充要方式就是「tap 后很快松开」。

**原文关键句**：

- Mojira 官方 bug 记录 MCPE-26819 描述（S4，基岩）：
  - *"This seems to happen when you place a block while moving and the crosshair happens to cross a block boundary **while the button is down, placing instantly**."*
    （按住放置按钮不放、移动中准星跨过方块边界时，会立刻再放一块。）——官方追踪器口径直接确认「按钮按住期间持续放置」。
- 官方搭桥文章（S3）：
  - *"You can safely build a bridge safely by **moving backwards while crouching as you place blocks**."*（一边后退蹲行一边放置方块。）
  - *"But with God Bridges you just **spam the button to place a block as quickly as you can** and hope for the best!"*（连点放置键尽可能快地放。）——连发与连点都是官方认可的高频放置方式。
- Wiki 搭桥教程（S11）：
  - *"To shift-bridge, simply crouch while moving backwards while **holding down the place blocks key**, facing the side of the blocks."*（按住放置键是标准操作。）
- Wiki Controls·Java（S5，按住 use = 重复发送使用输入的机制性证据）：
  - *"If the player holds the attack or use button …, the corresponding button's **input repeatedly gets sent**."*（F3+T 重载资源条目，顺带言明按住攻击/使用键会重复发送输入。）
  - use 条目亦含 *"charge a bow (release to fire)"*——use 按住的语义按物品种类分派（蓄力类按住蓄力、方块类按住连放）。
- 触控口径（S5/S6）：放置写成「**tap** the desired area to place the block」、破坏写成「**hold** finger down … to break」——即触控的「一次放置」由 tap 的短时长定义，长按则转入破坏通道（见 Q1/Q4）。

> **存疑注**：
> 1. Java 按住右键连放的**精确间隔**（社区通行说法为 4 game ticks ≈ 0.2s）未在本次抓取页面找到明文，不作结论；「按住=连发」本身证据充分。
> 2. 基岩触控 tap-to-interact 下「手持方块、手指按住表面不放」没有专门单句描述。由「触控放置与 K&M use 同一动作」+ S4（按住连放）+ S1 触控章（tap=放置、按住=砍）推断：按下即放置一次，按住不放期间随着移动/准星变化继续放置；持续按住同一位置在手不移动时不会无限堆叠（同位置无新放置面）。此为推断链，非逐字明文。

**对本项目的直接含义**：MC 的两条主通道（放/挖）在「按住」语义上都是连发；若本项目的 ⛏️ 在放置分支做「一次一放、不触发 onHold」，属于对官方语义的**刻意简化**（理由见 §5），不是复刻。

**来源**：S3、S4、S5、S11。

---

### Q4. 挖掘的按住连发

**结论**：**长按 = 持续挖掘直至破坏；手指不动时，破坏后自动接着挖视线/触点的下一个方块（连挖）**，块与块之间有 6 tick（0.3s）间隔；目标一变、进度重置；松手停止。创造模式（触控）另有「首块 800ms 防误拆延迟」官方开关，默认开。

**原文关键句**（均 S7，除注明外）：

- *"By **holding down the destroy button** while looking at a block within range, the player's hand begins swinging, making a repetitive sound as the player hits the block. Cracks appear on the block…"*（按住破坏键，手开始持续挥动、出现裂纹。）
- *"If the tool and enchantments immediately exceed the hardness times 30, the block breaks with no delay; **otherwise a 6 tick (3⁄10 second) delay occurs before the next block begins to break**."*（瞬挖无间隔；否则**下一块开始破坏前有 6 tick 延迟**——连挖存在的直接证据。）
- *"The progress for breaking a block is reset if the target block changes while breaking. Progress is also reset whenever the breaking control is released."*
- 触控触及距离（S7）：*"In Bedrock Edition … when using touch input, the range is **12 blocks in Creative mode and 6 blocks otherwise**."*（触控比键鼠够得更远——官方对触控挖掘的专门照顾。）
- 创造防误拆（S2 官方 changelog + S6 设置表）：
  - *"Added toggle **'Delayed Block Breaking (Creative Only)'** in Touch Settings to control this functionality"*（S2）。
  - *"Turns on **slower block breaking in creative mode, which can help prevent accidental block breaking**. In 'Joystick & aim crosshair', this is only available when 'Show action buttons' is disabled."*（S6）

**来源**：S2、S6、S7。

---

### Q5. 吃食物

**结论**：**tap 短按不吃，必须按住（hold-to-eat）**，标准食物 1.6 秒（32 game ticks）吃完；两版口径一致。手持食物 tap **动物** = 喂食（基岩触控弹出/长按触发 Feed 情境动作），tap **敌对生物** = 攻击；手持食物 tap **可交互方块** = 开方块（Q2 规则），tap 普通表面 = 无放置（食物不可放置）。

**原文关键句**：

- Wiki Food（S8）：
  - *"**Eating a food item requires holding use**, and takes an amount of time dependent on the food's consumption time value."*（吃必须按住 use。）
  - *"Eating (or drinking) a consumable takes **32 game ticks (1.6 seconds)**, with exceptions: Dried kelp takes half the time (16 game ticks (0.8 seconds)), and honey bottles take 25% longer (40 game ticks (2 seconds))."*
  - *"Cake is a block and thus cannot be eaten in the hand, requiring the player to place it down and then use it."*（蛋糕是方块：先放置再 use 吃——放置与吃分层。）
- 基岩触控喂食情境动作（S5）：
  - *"Some items have extra functionality, and these can be executed when either **long-pressing on the target or tapping the interaction button, located on top of the hotbar**. … **Feed**: to feed an animal while holding food, feed another animal so that both of them can breed."*
- 两版一致性声明（S1）：*"The basic Minecraft controls are pretty much the same between both versions of the game – Bedrock and Java. So unless we mention a difference, you can assume it'll work the same way on both."*
- 攻击与吃的互斥细节（S5，Java use 条目）：*"This also means a player can punch an entity while eating/drinking, however **the eating/drinking resets when a player presses Button 1**."*（吃的过程中按攻击键会打断进食——两通道互斥、attack 优先打断。）

**来源**：S1、S5、S8。

---

### Q6. 工具/武器：同一输入按目标类型分派

**结论**：**是**。官方把该输入直接命名为一个动作「**Attack/Destroy**」：对生物=单击攻击，对方块=按住破坏——同一绑定、按**目标类型**分派，与手持物无关（手持方块时左键/RT 依然是破坏）。工具影响的是**速度与掉落**，不是分派方向；剑也能挖（一般方块仅 1.5×，蛛网 15×、竹子 30×）。

**原文关键句**：

- Wiki Controls（S5）：
  - Java：*"Left Mouse Button | **Attack/Destroy** | `key.attack` | **Destroy blocks (hold down); Attack entity (click once).**"*
  - 基岩 K&M：*"Attack/Destroy | **Destroys blocks (hold down); Attacks (click once).**"*（几乎逐字相同。）
  - 手柄：RT = **Attack/Destroy**，LT = **Use Item/Place Block**（一个键管打/挖，另一个键管放/用）。
  - 触控准星模式：*"Attack button … **Attack mobs and destroy blocks**."*
- Wiki Breaking 工具速度表（S7）：无工具 1×；木 2×；石 4×；铜 5×；铁 6×；钻 8×；下界合金 9×；金 12×；**剑 1.5×（蛛网 15×、竹子 30×）**；剪刀对羊毛 5×/树叶 15×/蛛网 15×。
- 触控挖掘进度图形随工具变化（S5）：*"…an icositetragonal icon on the screen, **varying on the tool being used to break it**."*
- 官方教学（S1，鼠标章）：*"you can use the **left mouse button to attack things** with it …, or the **right mouse to place** whatever you're holding…"*——左键攻击/右键放置的二分与手持物解耦。

**来源**：S1、S5、S7。

---

### Q7. TNT 特例

**结论**：
1. **空手/工具 tap TNT = 挖走（瞬挖、掉落自身），绝不会点燃**。TNT 硬度 0、任意工具（含空手）瞬挖掉落——两版一致。误触零危险：想拆 TNT 随时可以安全拆走。
2. **点燃走 use 通道且需特定物品/信号**：打火石、火焰弹（use）；红石信号；火焰蔓延/燃烧弹射物/爆炸；**基岩特有：手持 Fire Aspect 附魔物品「打」TNT 也会点燃**（唯一的攻击通道点燃方式）。
3. 潜行 + 打火石点 TNT = 在 TNT 上生火而不立即引爆（细枝末节，列出备查）。

**原文关键句**：

- Wiki TNT（S9）：
  - 信息框：Tool **Any tool**；Hardness **0**。
  - *"TNT can be **broken instantly with any tool or by hand**."*
  - Activation 列表：*"**Using a flint and steel or a fire charge**"*；*"Using an item enchanted with **Fire Aspect** ‌[Bedrock Edition only]"*；*"A redstone signal"*；*"Fire spreading onto the TNT block"*；*"Projectiles that create fire or explosions"*；*"Other explosions"*。
  - *"Attempting to ignite TNT **while sneaking** results in the block catching fire, rather than the TNT becoming primed immediately."*
  - 方块状态（两版同名异名：JE `unstable` / BE `explode_bit`，默认 false/0）：*"Hitting the TNT block **breaks it, dropping it as an item** that can be picked up."*（默认态：打=破坏掉落；只有命令/附加包把该状态设为 true 时「打=点燃」。）
  - 版本史（Java Beta 1.7，规则起源）：*"TNT can be primed only by redstone … as well as by hitting it with flint and steel. **If the player hits TNT with an empty hand or while holding any other item, the block is destroyed and dropped as an item.**"*
  - 版本史（基岩 v0.15.0 build 1）：*"TNT can now be **ignited when hit with an item that has the Fire Aspect enchantment**."*
- 触控情境按钮（S5）：Interact button 列表含 *"**Ignite**: to ignite a creeper while holding a flint and steel"*——wiki 只点名苦力怕，未单列 TNT 的 Ignite 按钮（如实说明）；TNT 的点燃在触控同样经 use（tap TNT 时打火石的物品使用优先于无交互的 TNT 方块）。

**对本项目的直接含义**：MC 官方语义是「**空手/工具点 TNT = 安全挖走；点燃是打火石/火焰弹/红石的专属 use 动作**」。本项目探险现有 `advTntTap`「短按=点燃」与官方相反（点燃被放在了攻击通道的 tap 上），见 §5 建议。

**来源**：S5、S9。

---

### Q8. 官方「单一情境感知主动作按钮」先例（准星模式 Action Buttons）

**结论**：
1. 基岩准星模式（Joystick & aim crosshair）的 Action Buttons 核心是**两个各自情境分派的按钮**：
   - **Attack（攻击）**：一个按钮同时「攻击生物 + 破坏方块」——按**目标类型**分派；
   - **Interact（交互）**：一个按钮同时「放置 + 使用方块/实体/物品 + 装备」——按**手持物 + 目标可交互性**分派，且同样内置「方块胜过物品」规则。
   - 外加常驻的跳跃/潜行/飞行升降/疾跑，以及默认关闭的 Pick block（1.21.50+）与视角切换（1.21.70+）。
2. **tap-to-interact 是官方最终形态的默认方案**：1.19.50 起对所有触屏设备默认启用（S2），现行 Settings 文案三个模式里两个仍是「**Tap and hold blocks to interact with them**」（S6）——挖与放共用同一根手指，按「手持物 + 时长 + 目标可交互性」分派；准星 + Attack/Interact 双按钮保留为进阶选项。
3. **官方从未把「挖/打/放」合并成一个按钮**——即使在按钮化的准星模式里也拆成 Attack 与 Interact 两键。拆键原因正是本项目遇到的同款歧义：手持方块时既要能放（use）又要能打/挖（attack）。

**原文关键句**：

- Wiki Controls 触控表（S5）：
  - *"Attack button, only visible with 'Joystick & aim crosshair' control mode. **Attack mobs and destroy blocks.**"*
  - *"Interact button, only visible with 'Joystick & aim crosshair' control mode. **Places blocks, interact with blocks, entities, or items, equip armor** from the hotbar if the associated armor slot is empty. If both the item held and the faced block interactable, the block overrules the item…"*
- Wiki Settings（S6）：
  - *"Show action buttons — **Turns on additional on-screen buttons for advanced play** … Toggles whether additional buttons or the touchscreen are used to interact with blocks and items. Only available when the control mode is set to Joystick & aim crosshair."*（默认开）
  - Control mode 描述：*"Joystick & tap to interact — Drag joystick to move. Drag anywhere else to look around. **Tap and hold blocks to interact with them.**"*
- 官方 1.19.50 公告/changelog（S2）：
  - *"New touch controls are now **enabled on touch devices by default**."*
  - *"**Removed the action delay from Attack and Interact buttons**"*（官方对两按钮的正式命名即 Attack/Interact）。
  - *"Action buttons now show up when in a Boat while using Crosshair mode."*

**来源**：S2、S5、S6（时间线细节另见前序调研 §8）。

---

### Q9. Java 版左右键分派表（对照）

**结论**：
- **左键（`key.attack`，Attack/Destroy）**：对生物=单击攻击；对方块=按住破坏。**与手持物无关**——手持方块左键依然是破坏（官方教学与键位表双源，见 Q6 引文）。
- **右键（`key.use`，Use Item/Place Block）**：多级优先链，**可交互方块的使用优先于手持物的使用**；潜行跳过方块交互、直接走手持物；手持物若是方块则 use=放置；食物/药水 use=按住吃/喝；弓弩 use=按住蓄力。副手物品仅在主手无可用 use 动作时生效。

**优先级（由 S5 use 条目 + S10 潜行条目汇总）**：

1. **实体互动**（骑乘/交易/喂食/命名等——潜行可跳过部分，如潜行+use=下坐骑/对方块放置）；
2. **方块使用**：目标方块可交互且未潜行 → 使用方块（*"the block overrules the item"*）；
3. **手持物使用**：潜行或方块不可交互时 → 使用手持物品（吃/喝/蓄力/放置/打火…）；**手持方块的使用=放置**；
4. 副手：*"This button also uses items in the off-hand. Only items with a right click function can be used, and they are available only if the item in the main hand does not have a right click action, or its right click action cannot be performed."*

**原文关键句**（S5 Java use 条目节选，长句已由上文 Q2/Q5/Q6 分引）：

- *"Right Mouse Button | **Use Item/Place Block** | `key.use` | Place blocks, summon entities with spawn eggs, toggle levers/doors (click once), charge a bow (release to fire) … use special blocks like chests, doors, and levers, enter vehicles, **eat food**, drink potions … Commonly, if both the item held and the block clicked on has a such purpose (like trying to place dirt on a chest), **the block overrules the item**."*

> **存疑注**：Wiki 没有「实体 > 方块 > 物品」的单一权威排序句；上表排序由 use 条目罗列、潜行例外与 S10 的优先级描述汇总而来，属**汇编结论**（各分句均有明文，整体排序无单句）。

**来源**：S1、S5、S10。

---

## 3. 「手持 × 目标 → 动作」分派总表（MC 官方口径汇总）

### 3.1 基岩触控·tap-to-interact（默认模式）

| 手持物 ↓ / 目标 → | 短 tap 生物 | 短 tap 可交互方块（箱/门/工作台/熔炉…） | 短 tap 普通表面 | 长按方块 |
|---|---|---|---|---|
| **空手** | 攻击（单击） | 使用方块（开门/开箱） | 无实质操作（破坏须长按） | 挖掘（进度图形随工具；创造首块 800ms） |
| **工具/武器** | 攻击（单击，伤害随武器） | 使用方块 | 无实质操作（瞬挖类方块例外：如 TNT 一击即毁掉落） | 挖掘（工具加速；剑仅 1.5×） |
| **可放置方块** | **攻击**（不是放置） | **使用方块**；潜行状态=**放置** | **放置** | 破坏通道（手持不影响挖掘身份） |
| **食物** | 动物=**Feed 情境动作**（长按或按钮）；敌对=**攻击** | 使用方块 | 无操作（不可放置） | **吃**（1.6s，按住；对动物=喂食） |
| **打火石/火焰弹** | 攻击（或 Ignite 情境按钮，如苦力怕） | 使用方块（若可交互） | 无操作（对 TNT 则=**点燃**） | 对 TNT=点燃；对易燃物=生火 |

依据：S1 触控章、S5 触控表与 Interact button 列表、S7、S8、S9。

### 3.2 键鼠 / 手柄（Java 与基岩同构，RT/LT 对应左/右键）

| 输入 ↓ / 目标 → | 生物 | 可交互方块 | 普通方块 | 空挥/空中 |
|---|---|---|---|---|
| **左键 / RT 按住** | 单击攻击（连击=连点） | 破坏（须**按住**） | 破坏（按住连挖，块间 6 tick） | 挥空 |
| **右键 / LT** | 实体互动（骑/喂/交易/命名） | **使用方块**（潜行跳过→走下一行） | **使用手持物**：食物=按住吃、方块=放置、工具=各自 use | 同左（吃/放置/蓄力） |
| **右键按住不放** | 视实体而定 | — | **连发放置**（移动中跨边界即放） | 蓄力类继续蓄力 |

依据：S1、S3、S4、S5、S10。

---

## 4. 与上一轮调研的衔接

- 本报告 Q8 的「Action Buttons / 三模式」结论与前序调研 §2/§4 一致并互为印证：前序调研给出布局与自定义项全貌，本报告补齐两枚核心按钮（Attack/Interact）的**语义分派细节**。
- 前序调研 §3.9 已列「点按=放置/使用、长按=挖掘、点按生物=攻击」，本报告 Q1–Q5 逐条补上了原始引文与边界条件（交互方块优先、潜行反转、hold-to-eat、连发节拍）。
- 前序调研 §6.7（挖掘必须按住并显示进度图形）与本项目设计稿 §6.7（改用显式 ⛏️ 键的偏离记录）在本报告 Q4 得到更完整的机制引文支撑。

---

## 5. 对本项目的映射建议

> 逐条注明「抄 MC」或「偏离 MC」及依据。设计落点以交接书 `handoff-touch-button-semantics.md` 与 `docs/touch-controls-design.md` §3.2/§4 为准，本报告只给规则层建议。
>
> **拍板后记（2026-10-24，晚于本节成文）**：用户最终拍板与建议 2/7/9 的差异——
> ① **全模式统一**手持感知（否决建议 9 的「建造/竞技场维持现状」）：建造/竞技场快捷栏**第 1 格常驻铁锹**作显式挖掘入口（选中铲子→⛏️=连挖，选中方块→⛏️=放置；桌面右键拿铲子=无操作）；
> ② **TNT 维持既有 D3 拍板**（否决建议 7 的「对齐 MC」）：空手/工具短按=点燃、按住=挖走，登记为儿童向刻意偏离（设计稿 §6.10）；
> ③ **拿方块时 ⛏️ 对锥内怪=放置而非攻击**（建议 2 的保留项未采纳）：按手持物二分到底，打怪换工具/空手（设计稿 §6.9）。

| # | 规则 | 抄/偏离 | 依据与说明 |
|---|------|--------|-----------|
| 1 | **主动作键的「打/挖」通道保持现状**：准星有怪=攻击（单击语义）、瞄准方块=按住连挖 | **抄 MC** | 官方 Attack/Destroy 即「同一输入按目标分派：对方块按住破坏、对实体单击攻击」（S5/S1，Q6）；连挖含块间 6 tick 延迟、松手重置（S7，Q4）。项目 250ms/块 均匀节奏是官方「块间延迟」的简化同构。 |
| 2 | **手持可放置方块 → 主动作=放置（aimClick(2)）；空手/工具/材料/食物 → 0 分支** | **抄 MC（分派判据）** | 与官方「Use Item/Place Block：手持方块 use=放置」一致（S5，Q9）；官方 tap-to-interact 里「拿方块点哪放哪、空手按哪挖哪」同构（S1，Q1）。注意官方里**手持方块 tap 生物=攻击**——项目探险的 ⛏️ 按下时若锥内有怪仍应可打（advMainAction 判定为放置时可保留「锥内有怪优先打」的例外，或接受简化）。 |
| 3 | **放置分支不做连放：一次一放，放置判定成立时跳过 onHold** | **偏离（建议维持项目方案）** | MC 官方按住=连发（S3/S4/S11，Q3），连放服务搭桥效率；儿童向无搭桥需求，误连放产生垃圾方块、且与「误拆不可逆、误放可逆」的护栏哲学冲突。属刻意简化，应记入设计稿 §6 偏离表。 |
| 4 | **挖掘分支保留按住连挖（onHold）** | **抄 MC** | Q4 全部引文。连挖是官方两版一致的「按住」语义；松手停止、进度重置也建议照抄（换目标即重新蓄力）。 |
| 5 | **交互方块优先（熔炉/箱子先开面板，再谈放置）** | **抄 MC** | "the block overrules the item"（S5/S10，Q2）。探险 onMouse(2) 现有「走近开面板→吃→放置」次序与官方链一致；MC 无潜行，项目不需实现潜行反转（设计稿 §6.3 已记录无潜行）。 |
| 6 | **吃保持「轻点/主动作 0 分支即吃」，不强制按住 1.6s** | **偏离（儿童向，已有先例）** | MC 是 hold-to-eat（S8，Q5），tap 不吃。对 6 岁用户长按 1.6s + 时机理解成本高；项目将吃降为短按属刻意简化。若担心误吃，可参考 MC「满饥饿不吃」的守门思想（S8）做「满血不吃」。 |
| 7 | **TNT：建议把「短按=点燃」改为对齐 MC 或至少文档化偏离** | **建议对齐 MC** | MC：空手/工具 tap TNT=瞬挖掉落（零危险），点燃=打火石/火焰弹/红石的 use 动作（S9，Q7）。项目 `advTntTap` 把点燃放在空手短按上，与官方相反：官方语义里孩子乱点 TNT 永远安全。至少应在注释/偏离表标注这是玩具化取舍；若对齐 MC，则「空手/工具短按=挖走、按住=连挖」「手持打火石轻点=点燃」。 |
| 8 | **⛏️ 图标随手持物切换（⛏️ ↔ 🧱）** | **抄 MC 理念** | 官方 Interact 按钮的存在本身说明「放置入口需要可发现性」；情境文字按钮（Feed/Ignite 等）浮于快捷栏上方（S5，Q8）。图标切换=把分派结果显性化，对儿童是零文案的情境提示。 |
| 9 | **建造/竞技场维持「⛏️=挖、轻点=放」不做手持感知** | **本地决策（无 MC 对应）** | MC 无「物品全为方块时如何收敛」的问题（它始终有轻点放置通道）；项目建造模式轻点=放置保留 use 通道，⛏️ 固定为 attack 通道，反而更接近 MC 准星模式的 Attack/Interact 两键分工。 |
| 10 | **不引入「首块 800ms 防误拆延迟」** | **维持既有偏离** | 前序调研 §6.7 与设计稿 §6.6 已定：显式按钮 + 放置可逆已消解误拆风险；本报告 Q4 补充该延迟在官方侧仅限创造模式触控（S2/S6），不适用本项目场景。 |

---

## 6. 参考文献列表

**官方第一手（minecraft.net / Mojira）**

1. Minecraft Controls（官方控制教学：鼠标键盘 / 手柄 / 触控三章全文） — https://www.minecraft.net/en-us/article/minecraft-controls
2. 1.19.50 Update Available on Bedrock（新触控默认启用公告 + 官方 changelog 全文） — https://www.minecraft.net/en-us/article/1-19-50-update-available-bedrock
3. How to Speed Bridge!（官方搭桥教学：连发放置与连点放置） — https://www.minecraft.net/da-dk/article/how-speed-bridge- （en-us 路径 404，da-dk 为现行可抓取语言版）
4. Mojira MCPE-26819（官方 bug 追踪器：按住放置键跨方块边界即时再放） — https://bugs.mojang.com/browse/MCPE/issues/MCPE-26819

**Minecraft Wiki（社区权威整理，2026-10-24 抓取现行版）**

5. Controls（Java 键位 + 基岩 K&M/手柄/触控全表） — https://minecraft.wiki/w/Controls
6. Settings（基岩设置现行全表，含 Touch 标签页） — https://minecraft.wiki/w/Settings
7. Breaking（挖掘机制：按住语义、进度重置、工具速度表、块间 6 tick、触控触及距离） — https://minecraft.wiki/w/Breaking
8. Food（进食：hold-to-eat、1.6s、蛋糕分层） — https://minecraft.wiki/w/Food
9. TNT（硬度 0 瞬挖掉落、点燃途径、Fire Aspect 基岩特例、explode_bit） — https://minecraft.wiki/w/TNT
10. Sneaking（潜行效果：use 优先级反转） — https://minecraft.wiki/w/Sneaking
11. Tutorial:Bridging（搭桥教程：按住放置键，页面自标 work in progress） — https://minecraft.wiki/w/Tutorial:Bridging

**本仓库关联文档**

12. docs/mc-touch-controls-research.md（前序调研：基岩触控布局/手势/版本时间线，S1–S14）
13. docs/touch-controls-design.md（触控设计定稿 §3.2/§4/§6）
14. handoff-touch-button-semantics.md（本次实现任务交接书，Temp 目录）
