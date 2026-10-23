# Minecraft（Java 版）红石电路与机关机制调研报告

> **调研说明**
> - 调研日期：2026-10-23。第一部分（机制规则）全部来自第一手权威来源 **Minecraft Wiki**（[minecraft.wiki](https://minecraft.wiki)，即 wiki.gg 系官方社区 Wiki，由 Weird Gloop 托管）的逐页抓取，未使用任何二手博客。
> - 第二部分（认知训练评估）来自学术一手文献：PubMed/PMC/ERIC/Crossref 逐条核验的论文原文或官方摘要（Diamond 2013 为 PMC 全文，其余均核对过题录与摘要）。
> - 版本口径：Wiki 当前反映最新 Java 版（1.21.x 分支之后）。本文核心机制多为长期稳定机制；已核验的引入版本单独标注（如目标方块 1.16、阳光探测器 1.5、铜灯泡 1.21）。
> - 本报告服务于本项目（6 岁儿童注意力训练体素游戏）的选型评估，**不涉及任何代码改动**。

---

## 1. 红石基础：信号系统与输入元件

### 1.1 红石信号总规则（信号强度 / 强弱充能 / 红石刻）

（来源：[Redstone mechanics – Minecraft Wiki](https://minecraft.wiki/w/Redstone_mechanics)，由 Signal_strength 页重定向）

- 红石是 Minecraft 的"电"：**功率元件**（拉杆、按钮等）产生信号，**传输元件**（红石粉、中继器、比较器）传递信号，**机制元件**（活塞、红石灯等）收到信号后执行动作（来源：[Redstone mechanics § Redstone components](https://minecraft.wiki/w/Redstone_mechanics)）。
- 信号强度为 **1–15 的整数**。红石粉每传 1 格衰减 1 点，因此单段红石粉最远传 **15 格**；传给方块或元件时强度不再衰减（来源：[Redstone mechanics § Signal transmission](https://minecraft.wiki/w/Redstone_mechanics)）。
- **信号强度不影响机制元件的行为**：活塞收到强度 1 与 15 的信号，伸出速度和距离完全相同；红石灯亮度也相同（来源：[Redstone mechanics § Redstone signal](https://minecraft.wiki/w/Redstone_mechanics)）。
- 时间单位：1 游戏刻（game tick）= 1/20 秒；社区惯例的"红石刻"= 2 游戏刻 = **0.1 秒**（来源：[Redstone mechanics § Terminology](https://minecraft.wiki/w/Redstone_mechanics)）。
- **强充能 vs 弱充能**：被中继器/比较器/电源元件充能的方块是"强充能"，能给相邻红石粉供电；仅被红石粉指向的方块是"弱充能"，只能激活相邻机制元件、不能给红石粉供电（来源：[Redstone mechanics § Powered blocks](https://minecraft.wiki/w/Redstone_mechanics)）。
- 激活行为分两类：**边沿触发**（如发射器：只在信号从无到有的瞬间执行一次）与**电平保持**（如红石灯、门：有信号就一直开着，信号消失才复位）（来源：[Redstone mechanics § Activation behavior](https://minecraft.wiki/w/Redstone_mechanics)）。
- **准连接性（quasi-connectivity，仅 Java 版）**：发射器、投掷器、活塞还能被"其正上方格子被充能"激活，即使那里是空气——这是社区电路（BUD 电源等）的基础怪癖（来源：[Redstone mechanics § Quasi-connectivity](https://minecraft.wiki/w/Redstone_mechanics)）。

### 1.2 红石粉（Redstone Dust / 红石线）

（来源：[Redstone Dust § Redstone component – Minecraft Wiki](https://minecraft.wiki/w/Redstone_Dust)）

- 放置后成为"红石线"方块：自动朝相邻的红石元件、以及上下高差 1 格的红石线连接成型（直线/转角/十字）；无邻居时呈十字。亮度随功率 15→0 递减变暗。
- 供电方式：相邻电源元件、强充能方块、中继器/比较器的输出端、或相邻红石线。不透明实体方块会"切断"上下高差连线。
- 指向或铺在可导能方块上的红石线给该方块**弱充能**；十字形态的红石线（JE）可右键切成"圆点"，圆点不给四邻供电。

### 1.3 红石火把（Redstone Torch）——天然的反相器

（来源：[Redstone Torch § Redstone component – Minecraft Wiki](https://minecraft.wiki/w/Redstone_Torch)）

- 火把**对其附着方块上的信号取反**：附着方块被充能 → 火把熄灭；解除 → 复燃。效果上把功率 0 变 15、1–15 变 0，即 **NOT 门（反相器）**。
- 点亮的火把**强充能其正上方方块**、弱充能其余相邻方块（附着方块除外）；状态切换耗时 2 游戏刻（0.1 秒）。
- **烧毁（burn-out）**：60 游戏刻内被强制开关超过 8 次会烧毁（冒烟、失效），需等状态变化计数降回或收到方块更新才恢复——这是对高频振荡的自我保护，也是"火把时钟"失灵的原因。

### 1.4 拉杆（Lever）——双稳态开关

（来源：[Lever – Minecraft Wiki](https://minecraft.wiki/w/Lever)）

- 右键在"开/关"两态间切换，**想点多快就点多快**；生物不能拨动拉杆（仅玩家，或风弹误触）。
- 开启时：给相邻红石粉/背对的中继器与比较器输出强度 15；**强充能其附着方块**；激活相邻机制元件（含上下）。开启时冒红色粒子提示。

### 1.5 按钮（Button）——单稳态脉冲源

（来源：[Button – Minecraft Wiki](https://minecraft.wiki/w/Button)；木质按钮细节：[Oak Button – Minecraft Wiki](https://minecraft.wiki/w/Oak_Button)）

- 按下后自动弹回：**石质按钮保持 20 游戏刻（1 秒），木质按钮 30 游戏刻（1.5 秒）**（来源：[Button § Redstone power](https://minecraft.wiki/w/Button)）。
- 激活期间给相邻红石粉 15 强度、强充能附着方块、激活相邻机制元件。
- 木质按钮还能被**射出的箭/三叉戟/风弹**压住触发，且保持到投射物消失（约 1 分钟）或被捡走（来源：[Oak Button § Activation](https://minecraft.wiki/w/Oak_Button)）；生物不能直接按按钮。

### 1.6 压力板（Pressure Plate，含测重压力板）

（来源：[Pressure Plate – Minecraft Wiki](https://minecraft.wiki/w/Pressure_Plate)；变体页 [Oak](https://minecraft.wiki/w/Oak_Pressure_Plate)、[Stone](https://minecraft.wiki/w/Stone_Pressure_Plate)、[Light Weighted](https://minecraft.wiki/w/Light_Weighted_Pressure_Plate)、[Heavy Weighted](https://minecraft.wiki/w/Heavy_Weighted_Pressure_Plate)）

| 压力板 | 触发者 | 输出信号 |
| --- | --- | --- |
| 木质（各木种） | 几乎一切实体：玩家、生物、**掉落物**、箭、经验球等 | 恒为 15 |
| 石质 | **只有生物/玩家/盔甲架**（掉落物、矿车不触发） | 恒为 15 |
| 轻测重（金） | 同木质（一切实体） | **强度 = 实体数**（上限 15） |
| 重测重（铁） | 同木质（一切实体） | **强度 = ⌈实体数 ÷ 10⌉**（上限 15） |

- 触发判定：实体碰撞箱与压力板上 0.25 格高的区域相交即触发；之后**每 20 游戏刻复查一次**，无实体则复位（来源：[Pressure Plate § Activation](https://minecraft.wiki/w/Pressure_Plate)）。
- 激活时弱充能四邻、**强充能其正下方方块**；压力板贴地极薄（1/16 格），可铺在栅栏上做"可穿过的探测器"。
- 有实体经过时矿车沿弯道可斜向触发相邻压力板，但石质板不被空矿车触发（来源：[Pressure Plate § Behavior](https://minecraft.wiki/w/Pressure_Plate)）。

### 1.7 绊线钩 + 绊线（Tripwire Hook）

（来源：[Tripwire Hook § Redstone component – Minecraft Wiki](https://minecraft.wiki/w/Tripwire_Hook)）

- 组成"绊线电路"：两个相对的绊线钩之间连 **1–40 格绊线（线绳）**；实体（玩家/生物/物品）碰到绊线区域即触发，离开即复位。
- 触发时输出强度 15（与拉杆同规则：充红石粉、强充能附着方块、激活机制元件）；绊线本身不带电，但其状态变化可被侦测器检测。
- 绊线被破坏时，钩子发出 **5 红石刻（0.5 秒）** 的脉冲——"有人剪线了"的报警用法。

---

## 2. 红石传输与逻辑元件

### 2.1 红石中继器（Redstone Repeater）

（来源：[Redstone Repeater – Minecraft Wiki](https://minecraft.wiki/w/Redstone_Repeater)）

- **二极管**：信号只能从后往前单向传输，输出恒为强度 15——既"续距"（把衰减的信号补回满值），又防信号回流。
- **延迟 4 档**：右键在 2/4/6/8 游戏刻（0.1/0.2/0.3/0.4 秒）间循环切换；4–8 档还会把短脉冲拉长到自身档位时长。
- **锁存**：被一个充能的中继器/比较器从侧面指向时，中继器**冻结当前输出**，无论后端输入怎么变；解锁后恢复（锁存能力自 Java 1.4.2 引入，见 [Redstone circuits/Memory § D latches](https://minecraft.wiki/w/Redstone_circuits/Memory)）。锁存中继器是搭建 D 锁存器/触发器的最小记忆单元。

### 2.2 红石比较器（Redstone Comparator）

（来源：[Redstone Comparator – Minecraft Wiki](https://minecraft.wiki/w/Redstone_Comparator)）

- 三种模式（前火把下=比较模式，上=减法模式）：
  - **维持**：无侧输入时，输出 = 后端输入强度（延迟 2 游戏刻）；
  - **比较**：`输出 = 后端 × [左 ≤ 后端 AND 右 ≤ 后端]`——任一侧更强则输出 0；
  - **减法**：`输出 = max(后端 − max(左, 右), 0)`。
- **读取容器满度**：隔着导能方块"望进"身后的容器，输出与满度成正比。公式：`信号强度 = floor(1 + (各槽满度之和 ÷ 槽位数) × 14)`，槽满度 = 物品数 ÷ 最大堆叠。可读箱子、熔炉、漏斗、发射器、矿车箱（配合探测铁轨）等。
- 这是原版最"数学化"的元件：强度比较、减法、满度百分比都发生在这里。

### 2.3 逻辑门家族：用基础元件拼出布尔逻辑

（来源：[Redstone circuits/Logic – Minecraft Wiki](https://minecraft.wiki/w/Redstone_circuits/Logic)）

| 逻辑门 | 语义 | Minecraft 中的典型实现 |
| --- | --- | --- |
| NOT（非） | 输入取反 | **红石火把**直接就是反相器（1 红石刻延迟） |
| OR（或） | 任一输入为 1 则输出 1 | 最简单：**一条红石线汇流**所有输入 |
| NOR（或非） | 全 0 才输出 1 | **多输入接一个火把**；wiki 称 NOR 是 MC 的"基本门"，所有门都可由 NOR 组成 |
| AND（与） | 全 1 才输出 1 | 常见实现 = **输入各自先取反（火把）的 NOR 门**（德摩根律）；典型用途：门同时需要"按钮+锁定拉杆" |
| NAND（与非） | 全 1 才输出 0 | AND 输出再取反；与 NOR 同为"万能门" |
| XOR（异或） | 两输入不同则 1 | 多由 AND/OR/NOT 组合；典型用途：**两个开关异地控制同一盏灯**（家里双控灯开关） |
| XNOR（同或） | 两输入相同则 1 | XOR 取反 |
| IMPLY（蕴含） | "若 A 则 B" | 不可交换输入的冷门门 |

- Wiki 还给出选门方法论：先列出真值表再对号入座（来源：[Redstone circuits/Logic § Concepts](https://minecraft.wiki/w/Redstone_circuits/Logic)）。

---

## 3. 执行机关（机制元件）

### 3.1 活塞 / 粘性活塞（Piston / Sticky Piston）

（来源：[Piston – Minecraft Wiki](https://minecraft.wiki/w/Piston)）

- 充能后伸出（含 2 游戏刻动画），**一次最多推 12 个方块**；路径上的实体被一并推走；断电后缩回，粘性活塞会把方块**拉回**。
- **推不动**的方块包括：黑曜石、基岩、各类容器（箱子/熔炉/漏斗等"带方块实体的方块"，JE）、延长中的活塞等；沙子/沙砾/铁砧等重力方块可推但失去支撑会下落；红石粉、火把、压力板等"依附型方块"被推会破碎成掉落物。
- 粘性活塞存在"**1 刻短脉冲会放开方块**"的怪癖（脉冲 ≤1 游戏刻时方块留在原地）——T 触发器的经典原料（来源：[Redstone circuits/Memory § T flip-flop](https://minecraft.wiki/w/Redstone_circuits/Memory)）。
- 粘液块/蜂蜜块被推时会**带动相邻活动方块**，是飞行器的核心（来源：[Piston § Redstone component](https://minecraft.wiki/w/Piston)）。
- 充档延伸会在 31×31×31 范围发出声音；活塞伸缩还能被幽匿感测体感知（vibration 10/11）。

### 3.2 侦测器（Observer）

（来源：[Observer § Behavior – Minecraft Wiki](https://minecraft.wiki/w/Observer)）

- 侦测其**正面朝向的方块发生的状态/形状变化**（放置、破坏、作物生长、活塞伸缩等），从背面红点输出**强度 15、长 2 游戏刻的强充能脉冲**。
- JE 检测"形状更新"（比 BUD 检测的范围窄而规则明确）；BE 检测一切方块更新（来源：[Observer § Behavior](https://minecraft.wiki/w/Observer)）。
- 被活塞移动后也会发一个脉冲——飞行器得以自驱动。

### 3.3 发射器 / 投掷器（Dispenser / Dropper）

（来源：[Dispenser – Minecraft Wiki](https://minecraft.wiki/w/Dispenser)；[Dropper – Minecraft Wiki](https://minecraft.wiki/w/Dropper)）

- 两者都是 9 格容器 + 机关：激活后等 **4 游戏刻（0.2 秒）**，从**随机非空槽**弹出 1 件物品；**只在上升沿执行一次**，持续充能不会连发。
- **发射器**对特定物品有"特殊动作"：箭会**射出**、打火石点火、桶放置/收回流体、TNT 变成点燃实体、盔甲穿到生物身上、骨肥催熟作物等（来源：[Dispenser § Behavior](https://minecraft.wiki/w/Dispenser)）。
- **投掷器**没有特殊动作，只会把物品"丢出"或**直接塞进正对着的容器**（箱子/漏斗/另一台投掷器），是物品管道的泵（来源：[Dropper § Behavior](https://minecraft.wiki/w/Dropper)）。
- 两者都可被准连接性激活（JE），且是"边沿触发"的典型代表。

### 3.4 漏斗（Hopper）

（来源：[Hopper § Redstone component – Minecraft Wiki](https://minecraft.wiki/w/Hopper)）

- 三大功能：把自身物品**推入**朝向的容器；从**正上方容器拉取**物品；**收集**正上方空间的地表掉落物。
- 传输节奏：水平漏斗链约 **2.5 件/秒**；收取物品后有 **8 游戏刻（0.4 秒）冷却**（来源：[Hopper § Collecting items](https://minecraft.wiki/w/Hopper)）。
- **红石锁存**：收到红石信号即三项功能全停；解锁后恢复。漏斗本身不发信号，但满度可被比较器读取。
- 漏斗链/漏斗塔是自动农场、物品分类的核心物流元件。

### 3.5 阳光探测器（Daylight Detector / daylight sensor）

（来源：[Daylight Detector – Minecraft Wiki](https://minecraft.wiki/w/Daylight_Detector)；自 Java 1.5（13w01a）引入，见该页 History）

- 根据日光强度输出 0–15 信号，**每 20 游戏刻（1 秒）更新一次**，也可手动右键刷新；火把等方块光**不影响**它。
- 右键切换为**反转模式**（月光模式）：输出 = 15 − 天空光，夜里输出高、完全遮蔽则恒 15。
- 头顶遮光会降低输出——"给探测器搭凉棚"就能造路灯开关。

### 3.6 目标方块（Target）

（来源：[Target § Redstone component – Minecraft Wiki](https://minecraft.wiki/w/Target)；自 Java 1.16（20w09a）引入，见该页 History）

- 被投射物击中时发红石信号：一般投射物保持 **8 游戏刻（0.4 秒）**，箭/三叉戟保持 **20 游戏刻（1 秒）**（类似石质按钮）。
- **信号强度 1–15 由命中点离方块中心的距离决定**——越接近靶心信号越强，天然是"打靶精度计"。

### 3.7 红石灯（Redstone Lamp）

（来源：[Redstone Lamp § Usage – Minecraft Wiki](https://minecraft.wiki/w/Redstone_Lamp)）

- 被激活**立即点亮**，光等级 15；断电后 JE 隔 4 游戏刻（0.2 秒）、BE 隔 6 游戏刻才熄灭。
- 是不透明可导能方块，本身就是"电路可视化输出"的最好载体。

### 3.8 音符盒（Note Block）

（来源：[Note Block § Playing music – Minecraft Wiki](https://minecraft.wiki/w/Note_Block)；自 Beta 1.2 引入，见该页 History）

- 触发方式：玩家攻击、玩家右键、收到红石信号；上方须为空气（或头颅）才能发声。
- **音高**：每次右键升高半音，共 **25 档（两个八度，F♯3–F♯5）**，第 25 次右键回绕到最低音；破坏重置。
- **乐器**：由**正下方方块的材质**决定，共 16 种乐器（不含头颅），例如木质方块=贝斯、沙/沙砾=小军鼓、玻璃=击镲、石头类=底鼓、金块=铃铛（来源：[Note Block § Instruments](https://minecraft.wiki/w/Note_Block)）。
- 每次发声冒出与音高对应颜色的音符粒子——把声音"画"了出来。

### 3.9 陷阱箱（Trapped Chest）与钟（Bell）

（来源：[Trapped Chest § Redstone component – Minecraft Wiki](https://minecraft.wiki/w/Trapped_Chest)；[Bell § Redstone component – Minecraft Wiki](https://minecraft.wiki/w/Bell)）

- 陷阱箱被玩家打开即输出红石信号，**强度 = 同时打开的玩家数（上限 15）**；强充能其下方方块；漏斗/投掷器进出物品**不会**触发。
- 钟（JE）收到红石信号敲一下；也可被玩家从特定角度敲响、被投射物击响（BE）。

---

## 4. 机械装置与物理实体

### 4.1 TNT

（来源：[TNT § Activation/Behavior – Minecraft Wiki](https://minecraft.wiki/w/TNT)）

- 点燃方式：打火石/火焰弹、**红石信号**、火焰蔓延、燃烧的箭/火球/爆炸波及、发射器使用打火石或直接投放 TNT。
- 被点燃后变为实体：常规引信 **80 游戏刻（4 秒）**；被爆炸引爆的只烧 **10–30 游戏刻（0.5–1.5 秒）**。
- 爆炸威力 4，最大伤害：困难 84.5 血、普通 56 血、简单 29 血；被炸毁的方块必掉落物品（等同正确工具挖掘）。
- 引信期间受重力/水流/活塞/爆炸推挤——"水冲 TNT"是经典机关玩法。

### 4.2 矿车与铁轨系统

（来源：[Minecart § Speed](https://minecraft.wiki/w/Minecart)、[Powered Rail](https://minecraft.wiki/w/Powered_Rail)、[Detector Rail](https://minecraft.wiki/w/Detector_Rail)、[Activator Rail](https://minecraft.wiki/w/Activator_Rail)）

- 矿车每轴速度上限 **8 格/秒**（斜向合计可达约 11.3 格/秒）；脱轨后 1–2 格内急剧减速。
- **动力铁轨**：充能时给矿车加速（每刻 +0.06 的加速能量）、把静止矿车推离面前的方块；**未充能时是刹车**，下坡也能刹停。一处电源可沿轨道传导激活两侧各 8 根（共 17 根）。
- **探测铁轨**：矿车压过即输出强度 15（信号时长恒为 20 游戏刻的整数倍）；配合比较器还能读出**矿车箱/漏斗车的满度**。
- **激活铁轨**：充能后摇晃并**弹出乘坐者**；引爆 TNT 矿车（4 秒后爆炸、威力随车速）；开关漏斗矿车的吸取功能。

### 4.3 重力方块（沙 / 沙砾 / 混凝土粉末 / 铁砧）

（来源：[Sand § Usage / Falling block entity – Minecraft Wiki](https://minecraft.wiki/w/Sand)）

- 下方支撑被移走后，方块变为"下落方块"实体，落到有完整顶面的方块上变回方块；落在火把、铁轨、红石粉等非完整方块上则**破碎成掉落物**。
- 下落实体存在超过 600 游戏刻（30 秒）即被删除；沙砾/沙子落在点燃的 TNT 上还能让水下爆炸生效（原版机制冷知识）。

### 4.4 水流

（来源：[Water § Spreading / Source blocks – Minecraft Wiki](https://minecraft.wiki/w/Water)）

- 水源在平地上**水平扩散最多 7 格**，向下无限流；扩散速度 1 格/5 游戏刻（**4 格/秒**）。
- 水会冲走并携带红石粉、火把、地毯等非固定方块；两个水源相邻且下方有实体方块时会生成新水源（"无限水"）。
- 水流按"离最近落水口的最短路径"分配流向——先向低处流的物理直觉。

### 4.5 其他机关类（简略）

- **门 / 活板门**：可右键或红石控制的开关式屏障，红石供电即开、断电即关（上升沿/下降沿行为的官方示例，来源：[Redstone mechanics § Activation behavior](https://minecraft.wiki/w/Redstone_mechanics)；门页 [Door – Minecraft Wiki](https://minecraft.wiki/w/Door)）。
- **船 / 竹筏**：水面载具实体（与认知训练相关性低，本次未展开调研，见 [Boat – Minecraft Wiki](https://minecraft.wiki/w/Boat)）。
- **地图**：探索/导航类物品而非机关机制，与本项目相关性低，不展开（见 [Map – Minecraft Wiki](https://minecraft.wiki/w/Map)）。

---

## 5. 电路组合范式（社区经典电路）

### 5.1 记忆电路（RS 锁存 / T 触发器 / D 锁存）

（来源：[Redstone circuits/Memory – Minecraft Wiki](https://minecraft.wiki/w/Redstone_circuits/Memory)）

- **RS 锁存器**：S（置位）输入让输出 Q 亮起并**保持**，直到 R（复位）信号到来。Wiki 给的典型用例：*压力板触发后警示灯长亮，直到有人按复位按钮*——"记住发生过的事"。
- **T 触发器（toggle/双稳态）**：每收到一次输入就**翻转**一次状态。典型用例：*按一次按钮门开、再按一次门关*（按钮的短脉冲被"记住并翻转"）。1.21 的**铜灯泡**本身"充能即翻转亮灭"，配比较器即是 1×2 最小 T 触发器（snapshot 23w43a 引入，来源：[Redstone circuits/Memory § Copper Bulb T flip-flop](https://minecraft.wiki/w/Redstone_circuits/Memory)）。
- **D 锁存/触发器**：数据端 + 时钟端，时钟有效时把 D 存进输出——数字电路的存储单元；用两个锁存中继器即可搭出门控 D 锁存。
- 记忆电路 = 电子学意义的"时序逻辑"：输出取决于当前**和过去**的输入（来源：[Redstone circuits/Memory § Terminology](https://minecraft.wiki/w/Redstone_circuits/Memory)）。

### 5.2 时钟电路（Clock circuits）

（来源：[Redstone circuits/Clock – Minecraft Wiki](https://minecraft.wiki/w/Redstone_circuits/Clock)）

- 定义：输出以固定周期自动通断的电路；周期 = on 脉冲 + off 脉冲时长之和，用游戏刻计量。
- **火把时钟**：最古老，但快于 3 刻通/3 刻断（3-clock）就会触发火把烧毁；**中继器环时钟**最简（两中继器成环，最短 4 游戏刻周期）；**漏斗时钟**靠物品在漏斗间来回移动计时，可做长周期定时器。
- 时钟是"没有玩家输入也在自己动"的电路——自动化农场、定时门、循环音乐的心脏。

### 5.3 密码锁 / 组合锁（Combination locks）

（来源：[Tutorial:Combination locks – Minecraft Wiki](https://minecraft.wiki/w/Tutorial:Combination_locks)；概述见 [Tutorial:Advanced redstone circuits § Combination locks](https://minecraft.wiki/w/Tutorial:Advanced_redstone_circuits)）

- **拉杆锁（顺序无关）**：n 个拉杆、2ⁿ 种组合，只有正确的一组同时拨对（AND 语义）才开门；构造 = 每个拉杆后按密码位接火把（取反）或中继器（不取反），全并入一条线。
- **物品展示框锁**：展示框可旋转 8 个方位，比较器读出 1–8，n 框共 8ⁿ 组合——"转图案对密码"。
- **顺序敏感锁（permutation lock）**：按对**顺序**按按钮才开（RS 锁存链 + AND 门），错序自动复位——即"输入密码"的红石版。
- 共性：密码锁 = 规则发现 + 状态记忆 + 组合推理的复合体。

### 5.4 整机范例

（来源：[Tutorial:Mechanisms – Minecraft Wiki](https://minecraft.wiki/w/Tutorial:Mechanisms)，社区机关大全；BUD 见 [Tutorial:Block update detector](https://minecraft.wiki/w/Tutorial:Block_update_detector)）

- 活塞门（隐藏墙/楼梯）、自动售货机（投币→出货）、快速投弹坑、方块交换器、红石灯地板、单向电梯等——全部由第 1–3 节的元件组合而成。
- **BUD（方块更新检测器）**：利用准连接性等怪癖搭出的"隐形传感器"，是红石工程师的高级技巧，机制上属于对更新规则的利用而非设计特性。

---

## 6. 认知能力映射：6 岁儿童 × Minecraft 机制 × 文献依据

### 6.1 六岁处于哪些认知能力的敏感期（文献综述）

| 认知能力 | 6 岁前后的发展状态 | 文献依据 |
| --- | --- | --- |
| 执行功能三核心：抑制控制、工作记忆、认知灵活性 | 三大核心 EF 在学前期快速发育，是"入学准备度"比 IQ 更强的预测因子；高阶 EF（推理、问题解决、计划）由三核心构建。抑制控制对幼儿"格外难"（4–9 岁同侧/异侧反应差异甚至大于记忆负荷差异），但可被"等一等"和视觉提示显著改善 | [Diamond 2013, *Annu Rev Psychol* 64:135–168（PMC 全文 PMC4084861）](https://pmc.ncbi.nlm.nih.gov/articles/PMC4084861/) |
| EF 可训练性 | 4–12 岁儿童的 EF 可经训练提升；**一切成功项目的共性 = 反复练习 + 挑战逐步提高**；起点差的孩子受益最大 | [Diamond & Lee 2011, *Science* 333:959–964（PMID 21852486）](https://pubmed.ncbi.nlm.nih.gov/21852486/) |
| 因果推理 | 2、3、4 岁儿童已能从"变化与共变"模式中推断因果（blicket detector 范式：把某些方块放上去机器就亮灯奏乐）；3–4 岁还能据此设计"让机器停下"的干预。**"放置→亮灯"式因果游戏正卡在学前儿童的强项上** | [Gopnik, Sobel, Schulz & Glymour 2001, *Dev Psychol* 37(5):620–629（DOI 10.1037/0012-1649.37.5.620）](https://doi.org/10.1037/0012-1649.37.5.620) |
| 空间技能与积木/拼图游戏 | 4–7 岁大样本（n=847，WPPSI-IV 标准化样本）：在控制其他认知能力后，积木/拼图类空间游戏频率与积木设计分仍有特异相关；3 岁幼儿的空间组装（copy-the-structure）成绩与早期数学技能相关 | [Jirout & Newcombe 2015, *Psychol Sci* 26(3):302–310（PMID 25626442）](https://pubmed.ncbi.nlm.nih.gov/25626442/)；[Verdine et al. 2014, *Child Dev*（DOI 10.1111/cdev.12165）](https://doi.org/10.1111/cdev.12165) |
| 空间技能可训练 | 217 项训练研究元分析：平均效应 g = 0.47，效果持久且能迁移到未直接训练的空间任务 | [Uttal et al. 2013, *Psychol Bull* 139(2):352–402（PMID 22663761）](https://pubmed.ncbi.nlm.nih.gov/22663761/) |
| "编程式玩具"的适宜年龄 | 5–7 岁（幼儿园至二年级）儿童在**为发育特征专门裁剪**的环境里能进行有意义的编程/规则搭建：ScratchJr 相比 Scratch 减少约 1/3 积木、去掉复杂菜单、最小化鼠标移动、界面直接映射手势 | [Flannery et al. 2013, *IDC '13*（DOI 10.1145/2485760.2485785）](https://doi.org/10.1145/2485760.2485785)；[ScratchJr 官网](https://www.scratchjr.org) |
| Minecraft 用于儿童教育的实证基础 | Minecraft 教育应用的系统文献综述（学习收益集中在动机、协作、空间/STEM 内容）；后续已有研究直接用 Minecraft 积木式建造训练空间技能 | [Nebel, Schneider & Rey 2016, *Educ Technol Soc* 19(2):355–366](https://www.j-ets.net/TOC.aspx?issue=2016-2)；[Carbonell-Carrera et al. 2021, *Entertainment Computing* 38:100427（DOI 10.1016/j.entcom.2021.100427）](https://doi.org/10.1016/j.entcom.2021.100427) |

> 诚实口径提示：曾广为流传的"打游戏的孩子抑制与工作记忆更好"的 ABCD 研究（Chaarani et al. 2022, *JAMA Netw Open*）**已被撤稿**（PubMed 记录标注 Retracted Publication，PMID 36279138）。游戏×儿童认知的正向证据应谨慎表述——这正与本项目"只讲注意力/认知技能练习、不提智商提升/治疗"的宣称纪律一致。

### 6.2 机制 → 认知能力映射表

| Minecraft 机制组合 | 主要训练的认知能力 | 映射逻辑与文献锚点 |
| --- | --- | --- |
| 拉杆/按钮 + 红石灯/门 | **因果推理入门**（输入→输出即时反馈） | blicket detector 的学前范式：放上去→亮灯，2–4 岁即可推断因果（[Gopnik 2001](https://doi.org/10.1037/0012-1649.37.5.620)）；"按 A 得 B"是所有机关的原型 |
| 木质 vs 石质压力板 | **类别知识与规则理解** | "掉落物能触发木质、不能触发石质"是一条可观察、可验证的类别规则；规则理解属于 EF 的认知灵活性家族（[Diamond 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC4084861/)） |
| 压力板/绊线"踩到才亮" | **抑制控制 / 干扰控制** | 需要"忍住不走直线、绕开触发区"，与本项目已有的抑制/干扰范式同构；幼儿抑制控制弱但可训练（[Diamond 2013 § Inhibitory Control](https://pmc.ncbi.nlm.nih.gov/articles/PMC4084861/)） |
| AND 门（双开关一灯） | **工作记忆 + 规则组合** | 必须同时记住两个开关的状态与"都要开"的规则（[Diamond 2013 § Working Memory](https://pmc.ncbi.nlm.nih.gov/articles/PMC4084861/)） |
| RS 锁存 / T 触发器 | **状态记忆（外化的工作记忆）** | 电路替孩子"记住"过去一次输入——理解"设备记得我来过"即是时序逻辑的直觉化（[Redstone circuits/Memory](https://minecraft.wiki/w/Redstone_circuits/Memory)） |
| 红石粉布线（含爬坡） | **空间推理 + 计划** | 在 3D 体素里规划路径，与积木/拼图的视空训练同源（[Jirout & Newcombe 2015](https://pubmed.ncbi.nlm.nih.gov/25626442/)；[Uttal 2013](https://pubmed.ncbi.nlm.nih.gov/22663761/)） |
| 活塞推方块谜题 | **空间变换 / 心理旋转** | 预判"推一格后的形状/通路"训练空间技能；Minecraft 建造类活动训练空间技能已有实证（[Carbonell-Carrera 2021](https://doi.org/10.1016/j.entcom.2021.100427)） |
| 音符盒跟打（听→重复） | **听觉工作记忆 + 序列记忆** | 音高 25 档、颜色粒子把音高可视化（[Note Block](https://minecraft.wiki/w/Note_Block)）；序列记忆 = WM 对"按时间展开的信息"的处理（[Diamond 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC4084861/)） |
| 中继器延迟/按钮时长 | **序列/顺序思维 + 时间预期** | "先按 A、等一下、再按 B"的两步序列；WM 定义包含"记住事情完成的顺序"（[Diamond 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC4084861/)） |
| 目标方块（强度随命中位置 1–15） | **持续警觉 + 精细视空控制** | 靶心→信号更强的连续反馈把"瞄得更准"变成可感知目标（[Target](https://minecraft.wiki/w/Target)），与本项目"持续警觉"范式同构 |
| 密码锁（拉杆/图形组合） | **规则发现 + 探索策略 + WM** | 2ⁿ 组合空间的假设—检验循环，是学前因果推理的进阶形态（[Gopnik 2001](https://doi.org/10.1037/0012-1649.37.5.620)） |
| 水流/重力方块机关 | **物理因果预测** | "抽掉支撑→沙落下堵住水流"的可视因果链（[Sand](https://minecraft.wiki/w/Sand)、[Water](https://minecraft.wiki/w/Water)） |
| 测重压力板（轻） | **数量感知（数感）** | 信号强度 = 实体数，把 1–5 的数量变成灯的亮度（[Light Weighted Pressure Plate](https://minecraft.wiki/w/Light_Weighted_Pressure_Plate)）——可选的数学启蒙副产品 |

---

## 7. 6 岁适宜性评估与裁剪方案

### 7.1 分级总表

| 分级 | 机制 | 理由与裁剪思路 |
| --- | --- | --- |
| **A：直接适合**（点击即玩、即时反馈、规则可见） | 拉杆、按钮（木/石）、红石灯、门/活板门、木质与石质压力板、音符盒、目标方块、阳光探测器（配合天色变化）、陷阱箱（改叙事为"惊喜箱"） | 反应均 ≤0.4 秒（灯即时亮、活塞 0.1 秒、按钮 1–1.5 秒自复位），无隐藏规则；只需把文字 tooltip 换成图标 + 中文 TTS |
| **B：裁剪后适合**（需做减法） | 红石粉、活塞/粘性活塞、中继器、AND/OR 门、RS 锁存/T 触发器、密码锁（2–3 开关）、矿车+动力/探测铁轨、漏斗、测重压力板（轻）、发射器（仅友好物品）、TNT（仅开路不伤害） | 裁剪要点见 7.2 |
| **C：不建议**（6 岁认知负荷/与本项目管理冲突） | 比较器（比较/减法/容器满度公式）、时钟电路、火把烧毁机制、BUD/准连接性、XOR/XNOR/IMPLY 门、顺序敏感组合锁、发射器武器类用法、矿车速度/充能传导数值、陷阱类叙事 | 见 7.3 |

### 7.2 B 级机制的裁剪思路（对应"如何做减法"）

- **红石粉 → 二值化"电线"**：保留"亮/不亮"与自动连接，**隐藏 0–15 强度数值**（强度本来就不影响机制行为，砍掉无损玩法，来源：[Redstone mechanics](https://minecraft.wiki/w/Redstone_mechanics)）；单关最长 5–8 格，超长自动视为接通。
- **活塞 → "推/拉方块的手"**：保留推 1–3 格、0.2 秒动画、粘性可拉回；去掉 12 格上限判定、不可推列表、BUD/准连接性；推不动时给"晃一晃"的可见反馈而非无响应。
- **中继器 → "慢一点的小方块"**：只保留 1 档固定延迟，图标化（如乌龟图案），不要求理解 4 档与脉冲拉长；锁存能力不暴露。
- **AND/OR 门 → 预设谜题而非搭门**：场景里摆好"两个开关 + 一盏灯"，孩子通过试验发现"要两个都打开"（AND 语义），不要求搭建火把取反结构（[Redstone circuits/Logic](https://minecraft.wiki/w/Redstone_circuits/Logic)）。
- **RS 锁存/T 触发器 → "记住的开关"**：一次点击保持、再次点击（或按复位钮）解除；配合图标（锁形图案）与 TTS："它记得你按过哦"。
- **密码锁 → 图形密码 + 无限重试**：2–3 个开关、密码以图形提示呈现（如西瓜/太阳/星星贴在墙上）；拨错只是"门没开 + 鼓励语音"，绝不重置进度。
- **矿车+铁轨 → 点击道岔/点击动力铁轨开关**：送小动物回家的单向路径规划；去掉 8 格/秒的物理调参，速度恒定、视线跟随矿车。
- **漏斗 → 颜色分拣机**：点击漏斗切换"只收红色/只收蓝色"，观察物品流动（原版 2.5 件/秒的节奏恰好适合观察，来源：[Hopper](https://minecraft.wiki/w/Hopper)）；红石锁存可保留为"暂停钮"。
- **测重压力板（轻）→ 数一数关卡**：站上 1 只/2 只/3 只小鸡，灯的亮度/点亮的灯数随之变化，把"数量→强度"降级为"数量→灯数"。
- **发射器/TNT → 烟花发射器/开路炸药**：发射器只射烟花、雪球等视觉友好的东西；TNT 沿用项目已有 TNT 密室经验，只炸开砖墙、无伤害、无失败惩罚。

### 7.3 C 级的排除依据

- **比较器**：比较/减法公式与容器满度计算依赖对 1–15 数值的运算工作记忆，6 岁儿童无法读出也无法口算（公式见 [Redstone Comparator](https://minecraft.wiki/w/Redstone_Comparator)）。
- **时钟电路**：输出与玩家输入脱钩（自动循环），违背"即时因果反馈"原则；火把烧毁是隐性惩罚（[Redstone Torch](https://minecraft.wiki/w/Redstone_Torch)；[Clock](https://minecraft.wiki/w/Redstone_circuits/Clock)）；且"倒计时/循环"与零倒计时压迫哲学冲突。
- **BUD/准连接性**：连资深玩家都需 wiki 解释的隐式规则（[Quasi-connectivity](https://minecraft.wiki/w/Redstone_mechanics)），对 6 岁是纯噪声。
- **XOR/IMPLY 等抽象门**：真值表语义超出具体运算期儿童的理解（Piaget 具体运算阶段的经典边界；逻辑门文档见 [Redstone circuits/Logic](https://minecraft.wiki/w/Redstone_circuits/Logic)）。
- **顺序敏感组合锁**：多步序列 + 错序重置 = 隐性惩罚 + WM 超载（[Combination locks](https://minecraft.wiki/w/Tutorial:Combination_locks)）。
- **陷阱类叙事**：与"零惩罚、过程性表扬"哲学冲突；陷阱箱保留信号机制但改造为惊喜叙事。

### 7.4 注意广度与挫败感的裁剪（关卡结构层）

- **2–3 分钟一关**：按"3–5 个同型微谜题 × 30–40 秒"或"1 个三步谜题 + 30 秒自由探索"组织；**成功干预的共性是"反复练习 + 渐进挑战"**（[Diamond & Lee 2011](https://pubmed.ncbi.nlm.nih.gov/21852486/)），即关卡内同一机制连做 3 次逐次加难，而非堆砌新机制。
- **零惩罚**：所有电路永不损坏（裁掉烧毁、炸毁玩家物品等）、错误输入的反馈是"灯没亮 + TTS 过程性鼓励语（'再试试另一个开关？'）"，无生命/资源损失、无失败结算画面。
- **零文字**：原版所有机制靠文字 tooltip 与 wiki 传播，本项目必须图标化 + 中文 TTS 语音讲解；ScratchJr 为 5–7 岁做减法（减积木、去菜单、最小化鼠标移动）是被验证过的设计路线（[Flannery 2013](https://doi.org/10.1145/2485760.2485785)）。
- **纯鼠标点选**：优先选"点元件本身"的交互（拉杆、按钮、活塞、铁轨岔口都是天然点击目标），避免原版"放置/朝向/对齐"的精细操作；点击目标要大（≥1 个方块），命中热区宽松。
- **宣称口径**：以上机制只能表述为"注意力与认知技能练习"（因果推理、工作记忆、空间推理等 EF 家族能力的游戏化练习），不得宣称提升智商或任何治疗效果；正向因果证据应保持克制（参考 6.1 的撤稿提示）。

---

## 8. 对本项目的落地建议排序

结合四条硬约束（纯鼠标点选、零文字依赖、TTS、2–3 分钟关卡）与实现成本从低到高排序：

| 优先级 | 功能包 | 核心玩法（一句话） | 训练目标 | 实现要点 | 对应五维范式 |
| --- | --- | --- | --- | --- | --- |
| **P0** | 拉杆/按钮 + 红石灯 + 门（"点亮小屋"） | 点击开关让灯亮/门开，逐步出现"一个开关管多盏灯" | 因果推理入门 | 3–4 种图标元件、状态机即可，无物理 | 新增"因果链"维度（或并入规则切换初级关） |
| **P0** | 木质/石质压力板（"谁能触发"） | 小鸡走过石板灯不亮、走过木板灯亮，推断规则并利用 | 规则理解/类别知识 | 实体碰撞判定 + 规则表 | 规则切换 |
| **P1** | 双开关 AND 门（"两把钥匙"） | 两个拉杆都打开灯才亮，逐渐混入单开关/反相开关 | 工作记忆 + 规则组合 | 逻辑表达式求值器（与/或/非） | 规则切换（高阶）/WM |
| **P1** | 音符盒跟打（"叮咚学唱歌"） | 听 2–4 音旋律→按顺序点击音符盒重复；粒子颜色=音高 | 听觉工作记忆/序列记忆 | 预生成序列 + 比对；音符盒规格 25 音高、颜色粒子可复用（[Note Block](https://minecraft.wiki/w/Note_Block)） | 视空记忆的听觉姊妹篇（可选新维度） |
| **P1** | 活塞推箱（"推开石头找路"） | 点击活塞伸缩把方块推进/拉出，腾出通道或搭台阶 | 空间推理/心理旋转 | 网格方块移动动画，无原版推不动列表 | 视空记忆 |
| **P2** | 图形密码锁（"打开宝箱"） | 观察墙上图形提示，拨对 2–3 个拉杆开箱 | 规则发现/探索策略 | 组合判定 + 图形提示系统 | 规则切换 + WM |
| **P2** | 目标方块投掷（"打靶心"） | 点击发射（固定轨道）命中靶，靶心越准灯越多 | 持续警觉/精细视空 | 射线检测 + 命中距离→反馈强度（复用 [Target](https://minecraft.wiki/w/Target) 的 1–15 设计） | 持续警觉 |
| **P2** | 绊线绕行（"不要碰到线"） | 控制角色绕开可见绊线取宝物 | 抑制控制/干扰控制 | 可见的线 + 碰撞触发（仅触发音效不惩罚） | 抑制/干扰控制 |
| **P3** | 矿车道岔（"送小猪回家"） | 点击动力铁轨/道岔改变矿车路线 | 规划/视空 | 路径图 + 开关状态 | 视空记忆（高阶） |
| **P3** | 漏斗颜色分拣（"彩色快递"） | 点击漏斗切换过滤颜色，看物品流动是否归位 | 类别/观察/数感 | 颜色匹配 + 2.5 件/秒节奏动画（[Hopper](https://minecraft.wiki/w/Hopper)） | 干扰控制（辅助） |
| **不做** | 比较器、时钟、BUD/QC、XOR/IMPLY、顺序锁、陷阱叙事 | —— | —— | 见 7.3 | —— |

> 落地提醒：新增"机关模式"遵循仓库现行流程（index.html 加卡/页/script + mode-registry.js 注册，见 AGENTS.md）；红石机制建议先做成 `-core` 纯核心模块（信号求值器 + 元件状态机）配同名单测，再逐模式包装。

---

## 9. 来源清单

### 9.1 Minecraft Wiki（minecraft.wiki，2026-10-23 抓取）

| 主题 | URL |
| --- | --- |
| 红石机制总论（信号强度/强弱充能/准连接性/方块更新） | https://minecraft.wiki/w/Redstone_mechanics |
| 红石粉 | https://minecraft.wiki/w/Redstone_Dust |
| 红石火把 | https://minecraft.wiki/w/Redstone_Torch |
| 拉杆 | https://minecraft.wiki/w/Lever |
| 按钮（含木质按钮） | https://minecraft.wiki/w/Button 、https://minecraft.wiki/w/Oak_Button |
| 压力板（总页 + 木质/石质/轻测重/重测重） | https://minecraft.wiki/w/Pressure_Plate 、/Oak_Pressure_Plate 、/Stone_Pressure_Plate 、/Light_Weighted_Pressure_Plate 、/Heavy_Weighted_Pressure_Plate |
| 绊线钩 | https://minecraft.wiki/w/Tripwire_Hook |
| 红石中继器 | https://minecraft.wiki/w/Redstone_Repeater |
| 红石比较器 | https://minecraft.wiki/w/Redstone_Comparator |
| 逻辑门电路 | https://minecraft.wiki/w/Redstone_circuits/Logic |
| 记忆电路（RS/T/D） | https://minecraft.wiki/w/Redstone_circuits/Memory |
| 时钟电路 | https://minecraft.wiki/w/Redstone_circuits/Clock |
| 电路总论 | https://minecraft.wiki/w/Redstone_circuits |
| 活塞 | https://minecraft.wiki/w/Piston |
| 侦测器 | https://minecraft.wiki/w/Observer |
| 发射器 / 投掷器 | https://minecraft.wiki/w/Dispenser 、https://minecraft.wiki/w/Dropper |
| 漏斗 | https://minecraft.wiki/w/Hopper |
| 阳光探测器 | https://minecraft.wiki/w/Daylight_Detector |
| 目标方块 | https://minecraft.wiki/w/Target |
| 红石灯 | https://minecraft.wiki/w/Redstone_Lamp |
| 音符盒 | https://minecraft.wiki/w/Note_Block |
| 陷阱箱 / 钟 | https://minecraft.wiki/w/Trapped_Chest 、https://minecraft.wiki/w/Bell |
| TNT | https://minecraft.wiki/w/TNT |
| 矿车 / 动力铁轨 / 探测铁轨 / 激活铁轨 | https://minecraft.wiki/w/Minecart 、/Powered_Rail 、/Detector_Rail 、/Activator_Rail |
| 沙（重力方块） / 水 | https://minecraft.wiki/w/Sand 、https://minecraft.wiki/w/Water |
| 门 / 船 / 地图（简略） | https://minecraft.wiki/w/Door 、/Boat 、/Map |
| 密码锁教程 / 进阶电路 / 机关大全 / BUD | https://minecraft.wiki/w/Tutorial:Combination_locks 、/Tutorial:Advanced_redstone_circuits 、/Tutorial:Mechanisms 、/Tutorial:Block_update_detector |

### 9.2 学术文献（均为一手来源，题录/摘要经 PubMed·PMC·Crossref·OpenAlex 核验）

| 文献 | 链接 |
| --- | --- |
| Diamond, A. (2013). Executive Functions. *Annual Review of Psychology*, 64, 135–168.（PMC 全文） | https://pmc.ncbi.nlm.nih.gov/articles/PMC4084861/ |
| Diamond, A., & Lee, K. (2011). Interventions shown to aid executive function development in children 4 to 12 years old. *Science*, 333, 959–964. | https://pubmed.ncbi.nlm.nih.gov/21852486/ |
| Gopnik, A., Sobel, D. M., Schulz, L. E., & Glymour, C. (2001). Causal learning mechanisms in very young children. *Developmental Psychology*, 37(5), 620–629. | https://doi.org/10.1037/0012-1649.37.5.620 |
| Jirout, J. J., & Newcombe, N. S. (2015). Building blocks for developing spatial skills. *Psychological Science*, 26(3), 302–310. | https://pubmed.ncbi.nlm.nih.gov/25626442/ |
| Verdine, B. N., Golinkoff, R. M., Hirsh-Pasek, K., et al. (2014). Deconstructing building blocks. *Child Development*. | https://doi.org/10.1111/cdev.12165 |
| Uttal, D. H., et al. (2013). The malleability of spatial skills: A meta-analysis of training studies. *Psychological Bulletin*, 139(2), 352–402. | https://pubmed.ncbi.nlm.nih.gov/22663761/ |
| Flannery, L. P., et al. (2013). Designing ScratchJr: Support for early childhood learning through computer programming. *IDC '13*.（原文 PDF） | https://doi.org/10.1145/2485760.2485785 / https://sites.bc.edu/devtech/wp-content/uploads/sites/181/2018/02/scratchjr_idc_2013.pdf |
| Nebel, S., Schneider, S., & Rey, G. D. (2016). Mining learning and crafting scientific experiments. *Educational Technology & Society*, 19(2), 355–366. | https://www.j-ets.net/TOC.aspx?issue=2016-2（亦可经 ERIC EJ1097278 检索） |
| Carbonell-Carrera, C., et al. (2021). Minecraft as a block building approach for developing spatial skills. *Entertainment Computing*, 38, 100427. | https://doi.org/10.1016/j.entcom.2021.100427 |
| Papert, S. (1980). *Mindstorms: Children, Computers, and Powerful Ideas*. Basic Books.（建构主义经典，图书） | —— |
| （反例提示）Chaarani, B., et al. (2022). Association of video gaming with cognitive performance among children. *JAMA Network Open*. **已撤稿**（Retracted Publication） | https://pubmed.ncbi.nlm.nih.gov/36279138/ |

> **数据核验提示**：文中全部机制数值（信号强度、延迟、引信时长等）逐条取自上述 wiki 页面 2026-10-23 抓取内容；学术结论均核对到原文/官方摘要。个别未展开调研的低相关条目（船、地图）已在正文标注"未展开"，未引用任何未核验数值。
