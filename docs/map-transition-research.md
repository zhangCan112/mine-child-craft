# 地图切换无感 / 无缝大世界（网页 · WebGL 体素游戏）· 调研报告

> 调研问题：为"冒险模式多主题地图（沙漠/雪原/丛林…）"调查网页/WebGL 游戏如何做到地图切换几乎不被感知，评估两个候选方向——
> A. 分地图 + 玩法空间遮罩过渡（门/隧道/传送门/电梯）；B. 单世界 + 分块流式加载（chunk streaming，生态群系式过渡）。
> 所有事实性论断附来源 URL 与来源性质；抓取失败或只有二手证据的地方明确标注。本仓库现状以源码为准（本报告只读未改）。
> 抓取日期：2026-10-27。§5 速查表与 §6 评估中标【建议】的内容是本报告基于证据的提案，非仓库既有规则。

## 0. 结论先行（TL;DR）

1. **两个方向在业界与 Web 上都有被验证的先例，但成本结构完全不同**。方向 B（chunk 流式）在 Web 上已被生产级验证——Minecraft 官方网页版 [classic.minecraft.net](https://classic.minecraft.net/) 就是用开源体素引擎 [noa-engine](https://github.com/fenomas/noa) 做的（[Minecraft Wiki：Minecraft Classic (JavaScript remake)](https://minecraft.wiki/w/Minecraft_Classic_(JavaScript_remake))；noa README 亦自列 "Minecraft Classic — from Mojang"）。但方向 B 需要 chunk 调度、跨 chunk 面剔除、分帧/Worker 网格化、内存治理一整套系统；方向 A（遮罩过渡）是业界最古老、最稳的手法，从 Metroid Prime 的门到 Minecraft 的下界传送门，全部核心配方都可以用 DOM overlay + 少量 Three.js 代码复刻。
2. **遮罩的本质是"用确定的仪式掩盖不确定的等待"**：Metroid Prime 同时最多只保留 2 个"房间"（现房间 + 目标房间），门的开门延迟就是加载本身（[Zoid Kirsch 开发者自述](https://metroiddatabase.com/metroid-prime-dev-stories)）；Minecraft 下界传送门要求玩家站满 **4 秒**才开始传送，传送瞬间目标区域已被 ticket 以半径 3 chunk 预加载 **15 秒**（[minecraft.wiki/w/Nether_portal](https://minecraft.wiki/w/Nether_portal)）——"遮罩空间 + 进门即预取"是一体的。
3. **教训同样明确：遮罩必须快**。Mass Effect 1 的电梯在慢硬盘上要 51–52 秒，成为一代玩家的吐槽符号，BioWare 关卡设计师原话是电梯"比加载屏更好、更有沉浸感——**前提是快**"（[Kotaku 对 Dusty Everman 的采访](https://kotaku.com/an-oddly-long-banter-filled-history-of-mass-effect-ele-472630862)）；重制版把 52 秒压到 14 秒并允许跳过（[gamepressure](https://www.gamepressure.com/newsroom/summary-of-novelties-in-mass-effect-legendary-edition/z02c9b)）。对 6 岁孩子，遮罩段应以 **2–5 秒**为上限设计。
4. 【建议】**本项目最推荐"A 打底、B 的最小子集做内脏"**：每张主题地图内部按 chunk（本仓库 `mesh-core`/`mesh-worker` 已是分块网格化）组织数据，整图常驻不卸载；切换时用**传送门式遮罩**（站桩 2–4 秒 + 全屏噪声/渐晕 + 音效）掩盖"旧图 mesh 卸载 → 新图 chunk 逐块构建 → 首屏 chunk 淡入"的尖峰。理由与证据见 §6。

---

## 1. 研究问题①：分块流式加载

### 1.1 Minecraft Java 版的 chunk 机制

来源性质：minecraft.wiki（社区主笔的事实性 wiki，是 Minecraft 机制事实上的标准参考），本节均抓取自 [Chunk](https://minecraft.wiki/w/Chunk)、[Simulation distance](https://minecraft.wiki/w/Simulation_distance)、[Nether Portal](https://minecraft.wiki/w/Nether_portal) 三页原文。

- **chunk 尺寸与分层加载**：chunk 是 16×16 的世界列（Java 主世界高 384 格，98,304 个方块），再按 16 格切成 section 只用于渲染传输。加载由 **ticket（票据）**驱动，每个 ticket 有类型、加载等级（level 22–44）与存活时间；等级越低加载越深。四个加载档位：Entity Ticking（≤31，全游戏机制可用）→ Block Ticking（32，"lazy chunks"，红石/作物可用但不刷实体）→ Border（33，仅可读写方块）→ Inaccessible（34+，**只跑世界生成**）；等级 >44 的 chunk **立即卸载**。
- **加载半径**：玩家 ticket 恒为等级 31；simulation distance 单独决定实体模拟的方形区域，边长 `l = min(2s+1, 63)`；1.18 起渲染距离改为以玩家为心的**圆柱**加载（21w37a 条目）。微软官方创作者文档给出的 Bedrock 缺省值：模拟距离默认 4、最高 12，渲染距离独立设置（[Simulation Distance, Render Distance, and Ticking Areas | Microsoft Learn](https://learn.microsoft.com/en-us/minecraft/creator/documents/simulationrenderdistanceguide?view=minecraft-bedrock-stable)）。
- **卸载策略**：除等级 >44 立即卸载外，整个维度有 **idle timeout（300 tick）**——维度内没有任何"保活 ticket"（玩家/强制加载/激活传送门/掷出的末影珍珠）就停止实体与方块实体 tick。1.21.9（25w31a）更把常驻的 spawn chunks 整个移除，1.20.5 时就已把默认半径从 19×19 砍到 3×3——官方自己在为性能做减法。
- **对"遮罩式切换"最关键的一条机制——传送门预加载目的地**：任何实体穿过下界传送门时，游戏在**目的地**放下 level 30、半径 3 的 ticket，目标区域连同外圈逐级递减的 chunk 被加载 **15 秒**（"These chunks remain loaded for 15 seconds but this timer gets refreshed each time the entity passes through"）。玩家侧的体验包装是：生存模式需在传送门内**站满 80 tick（4 秒）**才传送，期间有"nausea 屏幕动画"（紫色扭曲全屏遮罩）与 `block.portal.trigger`（进入时）→ `block.portal.travel`（传送后）两段音效；1.16 20w06a 更新说明原文直接写着 "Traveling through Nether portals is now almost seamless"。
- **chunk 淡入**：1.21.11（25w44a）起 chunk 不再凭空出现而是**淡入**，淡入时长可在视频设置里调——这是官方版的"新内容浮现"遮罩，网页体素游戏可直接模仿（对材质 `opacity`/`transparent` 做几百毫秒渐变）。

小结（给方向 B 的参数锚点）：Minecraft 用"**分层加载半径 + ticket 保活 + 边界立即卸载 + 目的地预取**"四件事把无限世界裁成有限工作集；网页版不需要照抄 ticket 体系，但"玩家周围一圈加载、更外一圈只生成、离开即卸载、进门先取目的地"的结构是通用的。

### 1.2 Three.js / WebGL 下的 chunk 实践

来源性质：three.js 官方手册（由 gman 捐赠、随 three.js 仓库维护的正式文档）+ MDN 官方文档 + 0fps（Mikola Lysenko 的体素几何学博客，体素网格化算法的标准引文）。

- **每个 Mesh = 一次以上绘制请求，数量直接决定帧率**：three.js 手册《Optimize Lots of Objects》用 19,000 个方块实测——逐 Mesh 添加时作者机器**不到 20fps**，合并成单一 geometry 后 **60fps**；并且同一页明确写道："in Minecraft it doesn't likely draw each cube individually but rather **creates groups of merged cubes and also selectively removing faces that are never visible**"（[threejs.org/manual/#en/optimizing-lots-of-objects](https://threejs.org/manual/#en/optimizing-lots-of-objects)，正文文件在仓库 [manual/pages/optimize-lots-of-objects.html](https://github.com/mrdoob/three.js/blob/dev/manual/pages/optimize-lots-of-objects.html)）。场景图节点数本身也是成本（文中 19,000 mesh 若各带 3 个辅助节点就是 8 万次矩阵计算）。
- **"按 chunk 建一个 mesh + 剔除被遮挡面"是官方手册教的体素做法**：three.js 手册《Voxel (Minecraft Like) Geometry》通篇就是这套——①逐方块建 Mesh 在 256×256 一层（65,536 个盒子）就慢到没法动，填满 256³ 直接**内存耗尽崩溃**；②正确做法是把世界切成 **32×32×32 的 cell**，空 cell 零存储；③为每个 cell 手工构建 `positions/normals/uvs/indices` 的 BufferGeometry，**相邻实心方块之间的面直接不生成**；④cell 用 `"x,y,z"` 字符串 id 映射到 `Uint8Array` 与 Mesh；⑤编辑一个方块后，重网格化它所在的 cell 及最多 6 个相邻 cell；⑥贴图用**图集（atlas）**，每个面按图集坐标算 UV（[threejs.org/manual/#en/voxel-geometry](https://threejs.org/manual/#en/voxel-geometry)，正文文件 [manual/pages/voxel-geometry.html](https://github.com/mrdoob/three.js/blob/dev/manual/pages/voxel-geometry.html)）。
- **视锥剔除在 three.js 是逐对象自动的**：`Object3D.frustumCulled` 默认为 true，渲染器按每个对象的包围球做视锥剔除（[three.js docs：Object3D.frustumCulled](https://threejs.org/docs/#api/en/core/Object3D.frustumCulled)）。因此"chunk = mesh"天然获得视锥剔除；手册还提示可手动把包围球设成 cell 范围，省掉 `computeBoundingSphere` 的开销。
- **网格化算法的上限**：0fps《Meshing in a Minecraft Game》给出三条实用结论：①评价标准只有两条——"更小的 mesh 更好"与"网格化延迟不能超过一两帧"；②**culling（剔除内部面）**后面数正比于表面积，对 16³ 实心块约比朴素法少 16 倍；③**greedy meshing** 至多是最优解的 8 倍、通常好得多（演示里 690 面 → 22 面）；④**mesh 应缓存，只在几何变化时重建**；甚至可以先跑"快而笨"的网格化立即上屏，空闲时（**"or alternatively in another thread"**）再跑高质量版本替换——这正是"过渡期先粗后细"的理论依据（[0fps.net/2012/06/30/meshing-in-a-minecraft-game](http://0fps.net/2012/06/30/meshing-in-a-minecraft-game/)）。

### 1.3 Web Worker 中做地形生成 / 网格化

来源性质：MDN 官方文档；配本仓库现状（`js/mesh-worker.js` 头注释）。

- **为什么必须搬出主线程**：地形生成与网格化是纯 CPU 密集任务，放在主线程必然与渲染/输入争抢，产生掉帧。Web Worker 与主线程通过消息通信；**`ArrayBuffer` 是 transferable 对象，转移是"字面意义上的零拷贝"**——原线程的 buffer 立刻失效（byteLength 归零），内存资源直接挂到目标线程（[MDN：Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)；注意 TypedArray 本身不可转移，要转移它的 `.buffer`）。体素数据（chunk 的 `Uint8Array`）和网格结果（positions/indices 的 ArrayBuffer）双向零拷贝传输，是 worker 网格化的标准模式。
- **无构建项目完全可行**：经典脚本环境里 Worker 入口就是一个普通 JS 文件（`new Worker('js/xxx-worker.js')`），Worker 内用 `importScripts()` 复用主线程同一份源码——**本仓库已经在这么做**：`js/mesh-worker.js` 头注释写明"与主线程共享同一份代码：importScripts 依次加载 config.js · voxel.js · mesh-core.js · texture-atlas.js；世界数据不共享——每次请求随消息携带区块打包（voxel.js packChunkData 的输出，ArrayBuffer transferable 零拷贝）"，且 `file://` 下 Worker 构造会被浏览器拒绝、`world.js` 有同步构建兜底，两条路径共享同一 remeshQueue。方向 B 最大的工程难点（离线网格化）在本仓库已存在。
- **主线程内的补充手段**：`requestIdleCallback` 把低优先级任务排进浏览器空闲期，回调按 FIFO 执行、可通过 `IdleDeadline` 查询剩余时间；MDN 强烈建议传 `timeout`，否则可能数秒不执行；**该 API 非 Baseline**（部分主流浏览器不支持，需 `setTimeout` 兜底）（[MDN：requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback)）。这与 0fps 的"空闲周期跑高质量网格化"是同一思想的 Web API 化。

### 1.4 chunk 数据持久化（IndexedDB / localStorage）

来源性质：MDN 官方文档（Storage quotas and eviction criteria，2026-01 更新版）。

- **容量量级差三个数量级以上**：Web Storage（localStorage + sessionStorage）**总共上限 10 MiB**（每 origin 各 5 MiB），且只能存字符串，超限抛 `QuotaExceededError`；IndexedDB 走各浏览器存储配额——Firefox best-effort 模式为 min(磁盘 10%, 10 GiB)、Chrome/Edge 为**磁盘 60%**、Safari 浏览器 App 约 60%（[MDN：Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)；[MDN：IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)）。
- **淘汰规则要注意**：best-effort 数据在存储压力下按 **LRU 按 origin 整体清除**；`navigator.storage.persist()` 可申请持久化，`navigator.storage.estimate()` 可查询用量（同上 MDN 页）。
- 【推算】体素数据本身很小：16×16×128 的 chunk 用 `Uint8Array` 只有 32 KB，一张 64×64 chunk（1024×1024 方块）的地图体素数据约 2 MB——连 localStorage 都勉强放得下，IndexedDB 则绰绰有余；真正大头是网格几何与贴图，而它们可以随时从体素数据重建。**结论：持久化只存"种子 + 玩家改动 diff"是网页体素游戏的标准姿势**，重进地图时重建 mesh 而不是存 mesh。

---

## 2. 研究问题②：过渡遮罩技巧（masking）

来源性质：本节尽量用开发者自述/GDC 演讲/官方更新日志等一手来源；个别只有二手证据的明确标注。

### 2.1 一手案例（按可复刻价值排序）

- **Metroid Prime 的门 = 加载屏本体（2002，GameCube）**。资深玩法工程师 Zoid Kirsch 在 20 周年开发自述中逐条说明：①"门有时很久才开，是因为**门后的房间还在加载**——同时最多只有两个房间在内存里：你在的房间和你正要去的房间"（正因如此多出口房间同一时刻只开一扇门）；②门的**蓝色力场在被打中后褪去 = "就绪"信号**，用可读的视觉语言掩盖等待；③房间以压缩形态载入（几何/贴图/模型/游戏数据），用一个开源解压库在单块内存里原地解压以省内存（[Metroid Database: Metroid Prime Dev Stories #1](https://metroiddatabase.com/metroid-prime-dev-stories)，另见 [GoNintendo 汇总](https://gonintendo.com/contents/12115-metroid-prime-dev-shares-unique-insights-in-honor-of-the-game-s-20-20-anniversary)；"同时加载超过两个房间会崩溃"亦见 [Wikitroid](https://metroid.fandom.com/wiki/Metroid_Prime_(game))）。
- **Minecraft 下界传送门 = 站桩遮罩 + 目的地预取（2010 至今）**。见 §1.1：4 秒站桩（玩家可中途退出取消）、紫色噪声全屏动画、两段音效、传送瞬间目的地 chunk 已被 15 秒 ticket 预加载；创造模式 1 tick 即走——**遮罩时长是按模式分级可配的**（[minecraft.wiki/w/Nether_portal](https://minecraft.wiki/w/Nether_portal)）。
- **Mass Effect 的电梯 = 反面教材之王（2007，Xbox 360）**。BioWare 高级关卡设计师 Dusty Everman（Normandy 与电梯的设计者）接受 Kotaku 采访：Citadel 停机坪到 C-Sec 的电梯 **51 秒**；他的原话是"**正常工作的电梯和气闸比加载屏更好、更有沉浸感——如果它们够快的话**"；因为慢硬盘下电梯被拉到不可接受，ME2 直接换回普通加载屏（[Kotaku: An Oddly Long, Banter-Filled History of Mass Effect Elevators](https://kotaku.com/an-oddly-long-banter-filled-history-of-mass-effect-ele-472630862)）。2021 年 Legendary Edition 在快硬件上把电梯压到 14 秒且可按键跳过（[gamepressure](https://www.gamepressure.com/newsroom/summary-of-novelties-in-mass-effect-legendary-edition/z02c9b)；[Wikipedia: Mass Effect Legendary Edition](https://en.wikipedia.org/wiki/Mass_Effect_Legendary_Edition) 也记载"reduced time spent in elevators that are utilized as a way to hide loading screens"）。
- **God of War（2018）：把"零加载"做成叙事约束**。整部游戏一镜到底、无加载屏、无转场黑屏（[Wikipedia: God of War (2018 video game)](https://en.wikipedia.org/wiki/God_of_War_(2018_video_game))；总监 Cory Barlog 的解释见 [Eurogamer 采访](https://www.eurogamer.net/god-of-war-director-explains-why-the-entire-game-has-no-camera-cuts)与 [Polygon 采访](https://www.polygon.com/2018/4/23/17263016/god-of-war-playstation-4-camera-single-shot)）。官方 GDC 2019 有 19 场 God of War 演讲可查（[Santa Monica Studio：GDC 2019 Presentations](https://sms.playstation.com/stories/our-gdc-2019-presentations-engagement)；无剪辑镜头的摄影演讲：[Creating a Deeper Emotional Connection: The Cinematography of God of War](https://www.youtube.com/watch?v=z0-ddTqz0XE)）。**注**：窄缝爬行/推石/电梯是其流式加载遮罩的具体载体这一说法广为流传，但本次未抓到 SMS 工程师逐字自述，属二手共识（如 [Vivid Gold 博客](https://vividgold.co.ke/blogs/digital-diary/the-art-of-gaming-trickery-hidden-loading-screens)，弱来源，仅作佐证）——但"封闭空间遮罩 + 保留玩家操作"的模式已被 Metroid Prime 一手证据确立，战神是同一手法的现代应用。
- **Destiny：把加载动画做成世界观（2014）**。IGN 评测原文："Even the somewhat over-indulgent load screen animations between worlds are eye-catching. Bungie made lemonade out of lemons here."（[IGN: Destiny review](https://www.ign.com/articles/destiny-review)）。Bungie 官方周报还披露过一个多人加载细节：比同伴加载快的玩家"不再被扔进黑屏"（"Players who load into Crucible matches faster than their peers will no longer be put into black screen"，[This Week At Bungie – 1/23/2020](https://www.bungie.net/7/en/News/article/48652)）——**遮罩要把最快与最慢的机器都兜住**。
- **塞尔达 BotW：仪式化进出场（2017）**。神庙是独立小地图，进入时"启动→蓝光门→下降"的固定仪式天然覆盖加载；GDC 2017 演讲《Change and Constant: Breaking Conventions with 'The Legend of Zelda: Breath of the Wild'》是设计一手来源（[GDC Vault](https://www.gdcvault.com/play/1024562)，[YouTube 全程](https://www.youtube.com/watch?v=QyMsF31NdNc)）。社区公认的"血月在剧情包装下重置世界/释放内存"（[Zelda Dungeon Wiki: Blood Moon](https://www.zeldadungeon.net/wiki/Blood_Moon)，二手）说明其大世界同样有内存治理，只是被叙事化了。
- **Ratchet & Clank: Rift Apart：遮罩下限由带宽决定（2021）**。Insomniac 核心技术总监 Mike Fitzgerald：PS5 SSD 让" rift 把你瞬间拉进平行世界"成为玩法（[The Verge 采访](https://www.theverge.com/22431256/ratchet-and-clank-rift-apart-ps5-interiew-tech-ray-tracing-ssd)；[PlayStation Blog](https://www.playstation.com/en-us/editorial/how-ps5-helped-make-ratchet-clank-rift-apart-possible/)）；Digital Foundry 的 PC 技术分析实测游玩期存储吞吐约 500 MB/s–1.2 GB/s，且 SATA 以下体验明显劣化（[Digital Foundry](https://www.digitalfoundry.net/articles/digitalfoundry-2023-ratchet-and-clank-rift-apart-pc-tech-analysis)）。**启示**：主机"无缝"的钱花在带宽上；网页的等效带宽是"网络预取 + CPU 生成速度"，所以网页版必须用更长的遮罩或更小的数据量换同样的体验。
- **通用的加载屏设计守则**：Game Developer（原 Gamasutra）2009 年专栏《Game Design Rules: Loading Screens》——加载断点放在节奏间隙；动作中宁要"短促无冒犯的加载指示"也不要全屏信息轰炸（举 Half-Life 2 为正面例子）；加载结束回到游戏前要有明确提示（[gamedeveloper.com](https://www.gamedeveloper.com/design/game-design-rules-loading-screens)）。

### 2.2 低技术成本、可在 Three.js r128 复刻的手法提炼

以下每条都能对应 §2.1 的一手出处，实现载体标注在括号里（全部不需要构建步骤）：

1. **门/门洞 + "就绪"视觉信号**（Metroid Prime 蓝力场）：一扇门的 mesh + 门后区域仍在构建时显示力场/光幕，构建完成播放开门动画。成本：低（一个状态布尔量 + 两个 mesh 切换）。
2. **传送门站桩 + 全屏噪声 + 音效**（MC 下界门）：玩家进入传送门方块/触发区，启动 2–4 秒倒计时（中途走出即取消），期间 DOM 全屏紫色噪声 overlay（CSS 动画或 2D canvas）+ `AudioCore` 播两段音效；倒计时结束才切换。成本：低。
3. **进门瞬间预构建下一图**（MC portal ticket 的 15 秒预加载）：跨进遮罩那一刻就把下一张地图的 chunk 打包发给 `mesh-worker`（已存在），遮罩结束时多数 chunk 已就绪。成本：低（调度逻辑）。
4. **保留玩家输入的爬行/滑行段**（战神/Jedi 类窄缝，模式由 Metroid 确立）：短隧道里锁相机方向、玩家按住前进以固定速度滑动 2–3 秒，滑动背后就是构建。对 6 岁孩子= 不剥夺操控感。成本：中（需要一个走廊场景与输入锁定）。
5. **电梯/上升段**（Mass Effect/Destiny，**必须快**）：数秒的垂直位移 + 轻微音效，超时则给"还在上升"的兜底文案而非黑屏。成本：中。
6. **白屏/黑屏短渐变**（通用；GoW 为叙事禁黑渐变，本项目无此约束）：300–800 ms 的全屏白（对幼儿比黑更友好）CSS opacity 过渡盖住最尖峰的一帧切换。成本：低。
7. **vignette 渐晕收缩**：CSS `radial-gradient` overlay 从边缘向内收紧，视野收缩本身就是"要传送了"的前置预告。成本：低。
8. **iris wipe 圆形开合**：`clip-path: circle()` 动画，卡通感强、与像素画风匹配。成本：低-中。
9. **chunk 淡入**（MC 1.21.11 官方做法）：新图首屏 chunk 材质 `transparent:true` + opacity 0→1 几百毫秒，遮罩收尾与新图浮现无缝衔接。成本：低。
10. **音效掩护**：任何遮罩配一层上升音/轰鸣/风声，听觉注意被占用后视觉瑕疵容忍度显著提高（MC portal.trigger/travel 的两段式即为范例）。成本：低（`audio-core` 已在）。

---

## 3. 研究问题③：预加载与内存预算

来源性质：MDN 官方文档 + three.js 手册实测数字 + 0fps；预算结论为【推算】的已标注。

- **空闲预取**：`requestIdleCallback`（注意非 Baseline，`setTimeout` 兜底）在玩家探索当前图时逐块预生成/预取下一图数据（[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback)）。本项目地形是种子化程序生成的（`adventure-core.js` 的 advBuildWorld 一族），**"预取下一图"= 提前算好体素 + 提前跑 mesh-worker**，没有网络资产要等，预取成本纯粹是 CPU 时间——requestIdleCallback/分帧完全够用。
- **draw call 预算的经验值**：three.js 手册的实测锚点——19,000 个 mesh <20fps、合并 1 个 60fps（作者机器）；按 chunk 合并后，一张 64×64 chunk 的地图大约是数百到一两千个 draw call，处于"手册案例"的数量级内，配合 `frustumCulled`（默认开）通常可控（[three.js manual: optimizing-lots-of-objects](https://threejs.org/manual/#en/optimizing-lots-of-objects)；[MDN: WebGL best practices — Batch draw calls](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)）。MDN 同页给出的通用准则："Batching draw calls into fewer, larger draw calls will generally improve performance"，并明确**纹理图集是合并 draw call 的关键手段**（换纹理就要断批）。
- **VRAM 预算方法**：MDN 转述 Google Maps 团队首创的 **per-pixel VRAM budget**——先定单机最大显存用量，除以最大化窗口的像素数得到常数，再按当前窗口像素数反推缓存上限，超限即清理（[MDN: WebGL best practices — Estimate a per-pixel VRAM Budget](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)）。对本项目更简单的版本：贴图只有一张 256×256 图集（`texture-atlas.js`，2 的幂、满足 WebGL1 mipmap 约束），VRAM 基本恒定，预算压力全在 geometry。
- 【推算】**内存粗账**（输入取自 minecraft.wiki 与 three.js 手册）：16×16×128 的 chunk 体素 = 32 KB；一张 64×64 chunk 地图体素 ≈ 2 MB，几何（平均每 chunk 数千面 × ~100 B/面）约几十 MB 量级——**同时保留 2 张已访问地图的 mesh 是可承受的**（对应 Metroid Prime 的"2 房间"策略），3 张以上就该卸到"只剩体素数据"。
- **贴图图集消切换开销**：图集让全图一次 draw 一批不断纹理（MDN 同上）；本项目已实现程序化 16×16 图集，`layout` 作为 UV 契约与网格核心共读（`texture-atlas.js` 头注释）——**新增主题（沙漠/雪原）只要扩图集格位，不存在切图换纹理的状态切换**。
- **"重进不重算的只有数据"**：IndexedDB 存"种子 + 玩家改动 diff"（容量见 §1.4），mesh 一律重建；localStorage 只放设置与存档槽索引（`save-slot.js` 已是此分工）。

---

## 4. 研究问题④：真实网页案例

### 4.1 classic.minecraft.net（Minecraft Classic 网页版）

来源性质：Minecraft Wiki + noa-engine README（互为印证，属一手/官方开源文档）。

- 它是 Mojang 为庆祝 10 周年（2019-05-07 上线）用 **JavaScript 重制**的 Classic 0.0.23a_01，整体仅 **8.92 MB**，明确记载"built with the [noa-engine](https://github.com/fenomas/noa) library"（[Minecraft Wiki: Minecraft Classic (JavaScript remake)](https://minecraft.wiki/w/Minecraft_Classic_(JavaScript_remake))）；noa README 的用户列表里同样写着 "Minecraft Classic — from Mojang (I'm as surprised as you are)"（[github.com/fenomas/noa](https://github.com/fenomas/noa)）。
- 它的加载体验：单张固定大小世界（Classic 本来就是有限地图），进入时一次性生成 + 网格化，游戏内没有"切换地图"概念——**官方网页版的取舍是"小世界全常驻"，而不是无限流式**。
- 性能敏感性：Wiki 记载其多人模式曾因性能问题被暂时关闭（"We've temporarily disabled multiplayer for Minecraft Classic while we work on some performance issues"，同上页面引 Mojang 官方）——即便 Mojang，Web 端性能预算也紧张。

### 4.2 noa-engine 的 chunk 处理

来源性质：noa-engine README 与 API 文档（作者 fenomas，MIT 开源；Babylon.js 渲染，与本项目 Three.js 不同但机制同构）。

- 引擎围绕玩家做 chunk 流式加载/卸载，README 更新日志给出了一整套与方向 B 直接对应的旋钮：**v0.30** 可分别配置垂直/水平 chunk 加载距离；**v0.31** `noa.world.chunkSortingDistFn` 控制 chunk 处理优先级（近处先建）；**v0.29** `worldGenWhilePaused`、`manuallyControlChunkLoading`（暂停时仍生成/完全手动控制加载）；**v0.33** 支持贴图图集与"整块全空气/全同种方块"的快速通道（[README changelog](https://github.com/fenomas/noa)）。API 参考：[fenomas.github.io/noa/API](https://fenomas.github.io/noa/API/)。
- 生产级用户还包括 [bloxd.io](https://bloxd.io/)（多人可编辑体素世界）与 VoxelSrv 等（同 README）——证明"浏览器 + 体素 + chunk 流式"能撑住真实产品。

### 4.3 Krunker（WebGL FPS 的地图切换体验）

来源性质：官方版本更新日志（一手）+ 社区地图文档（二手）。

- Krunker 官方 changelog 多次出现 "Optimized initial Map Loading time"、"Map Loading/Generating optimizations"、"Optimized Map Export File Size"（[krunker.io/docs/versions.txt](https://krunker.io/docs/versions.txt)）——**地图加载速度是其持续投入的优化项**，即它的"秒切图"不是免费的。
- 其地图本质是一份 JSON 对象清单（objects 数组 + 环境配置 + 出生点），社区文档与示例 map.json 可证（[KrunkerMapDocs](https://github.com/giantninja908/KrunkerMapDocs/blob/main/mapDocs.md)、[示例 map.json](https://github.com/Charly-T/krunker-admin-panel/blob/main/map.json)）——切换地图 = 同引擎热替换一份数据描述。对方向 A 的启示：**主题差异表达成数据（方块调色板/结构清单），引擎不动，切换才便宜**。

### 4.4 其他参照

- **Eaglercraft 路线**（TeaVM 把 Java 字节码 AOT 编译成 JS/WASM 跑完整 Minecraft，[eaglercraft.com](https://eaglercraft.com/)、[TeaVM Overview](http://www.teavm.org/docs/intro/overview.html)）：证明现代浏览器跑完整 chunk 流式可行，但依赖整条 Java 工具链，与本仓库"无构建步骤"约束冲突，仅作能力上限参照。

---

## 5. 可复刻手法速查表【建议】

实现成本：低 = 纯 DOM/CSS/调度逻辑；中 = 需要新场景资产或新状态机；高 = 需要引擎级改造。
"6 岁友好"指手法本身对该年龄段的体验（可预期、不吓人、保留操控）。"适合 r128"按无构建步骤、经典 script 环境评估。

| # | 手法 | 业界出处（见 §2–§3） | 实现成本 | 6 岁孩子友好 | 适合无构建 Three.js r128 |
|---|------|----------------------|----------|--------------|--------------------------|
| 1 | 传送门站桩 2–4s + 全屏噪声 + 双段音效，可中途退出 | MC 下界门（4s/80 tick，可退出） | 低 | ★★★ 仪式感强、可预期 | ✅ DOM overlay + CSS + audio-core |
| 2 | 进遮罩瞬间预构建下一图 chunk | MC portal ticket 预加载 15s | 低（mesh-worker 已在） | 无感层 | ✅ 纯调度 |
| 3 | 门/光幕 + "就绪"信号后开门 | Metroid Prime 蓝力场 | 低-中 | ★★★ 有反馈的等待 | ✅ |
| 4 | 白屏/黑屏短渐变（300–800ms） | 通用守则（Game Developer 2009） | 低 | ★★☆ 建议白色 | ✅ |
| 5 | vignette 渐晕收缩 / iris wipe 圆形开合 | 通用转场语言 | 低-中 | ★★★ 卡通感 | ✅ CSS overlay |
| 6 | 音效掩护（上升音/风声/轰鸣） | MC portal.trigger→travel 两段式 | 低 | ★★★ | ✅ audio-core |
| 7 | chunk 淡入（新图浮现） | MC 1.21.11（25w44a）官方做法 | 低 | ★★★ | ✅ 材质 opacity 渐变 |
| 8 | 保留输入的爬行/滑行窄道 | 战神窄缝（模式源自 Metroid 门） | 中 | ★★★ 不剥夺操控 | ✅ 需走廊场景与输入锁定 |
| 9 | 电梯/上升段（**务必 <5s，超时有兜底文案**） | Mass Effect（反面）/Destiny | 中 | ★★☆ | ✅ |
| 10 | 空闲预取下一图数据（ric + setTimeout 兜底） | MDN requestIdleCallback | 低 | 无感层 | ✅（注意非 Baseline） |
| 11 | 每 chunk 一个 mesh + frustumCulled 默认剔除 | three.js 手册 voxel-geometry / docs | 已具备 | 无感层 | ✅ mesh-core/world.js 现状 |
| 12 | 程序化贴图图集统一材质（新主题=扩格位） | MDN batching；texture-atlas.js | 已具备 | 无感层 | ✅ 256² PoT 满足 WebGL1 |
| 13 | 保留上一张图 mesh 的 1–2 格 LRU（回程秒开） | Metroid Prime"最多 2 房间" | 中 | ★★★ 原路返回立即就绪 | ✅ |
| 14 | IndexedDB 存"种子+改动 diff"，mesh 只重建不落盘 | MDN 存储配额（§1.4） | 中 | 无感层 | ✅ |
| 15 | Worker 网格化 + ArrayBuffer 零拷贝 | MDN Transferable；0fps "another thread" | 已具备 | 无感层 | ✅ mesh-worker.js 现状 |
| 16 | 两级网格化（先粗后细，遮罩期先上屏） | 0fps meshing 结论④ | 高 | 无感层 | ⚠️ 可选，方向 B 深水区 |
| 17 | 单世界无限流式（方向 B 全套） | noa-engine / classic.minecraft.net | 高 | ★★☆ 缺少"换地图"仪式感 | ⚠️ 可行但工程量大 |

## 6. 对本项目两个候选方向的评估【建议】

结合外部证据（§1–§4）与本仓库现状（只读核实：`mesh-core.js`/`mesh-worker.js` 已实现分块网格化 + Worker 零拷贝 + file:// 兜底；`texture-atlas.js` 已是 256² 程序化图集；`adventure-core.js` 已有"地图常量表 + 种子化地形生成"的形状；`mode-registry.js`/`save-slot.js` 就位）：

- **方向 A（分地图 + 遮罩过渡）——推荐为骨架**：
  - 工程量小：主题差异下沉为数据（图集格位 + 地形常量表，Krunker 式"换 JSON 不换引擎"），遮罩是 DOM/CSS/音频层的低风险工作。
  - 体验有据：Metroid Prime 的门、MC 的传送门都证明"门 + 就绪信号 + 目的地预取"能让加载在感知上消失；MC 甚至为传送门配了 4 秒站桩——**等待被包装成仪式**，这对 6 岁孩子是加分项（明确的"我要去雪原了"预告），而方向 B 的无缝过渡反而没有"到了新世界"的可感知节点。
  - 风险点：遮罩必须快（Mass Effect 教训）。本项目的"加载"是纯 CPU 生成 + 网格化（无网络资产），进门即预构建（速查表 #2）后，遮罩 2–4 秒是充裕的。
- **方向 B（单世界 + chunk 流式）——取其最小子集做内脏**：
  - Web 可行性已被 noa-engine / classic.minecraft.net / bloxd.io 证明，但那是引擎级投入（加载距离、处理排序、暂停期生成、手动控制加载……noa 用了三十多个版本打磨这些旋钮）。
  - 本仓库的 mesh 分块 + Worker 已是方向 B 的核心零件；缺的是"按玩家位置增量加载/卸载 chunk"的调度器与跨 chunk 边界的世界数据治理。对"多张主题地图"的需求，为每张主题维护一套生态群系参数（单世界内按区域切换）复杂度更高，且 6 岁孩子对"生态群系渐变"的感知远弱于"穿过传送门到了雪原"。
  - 结论：**不推荐现在做完整方向 B**；但地图内部按 chunk 组织数据/网格（现状即是）务必保留——它让"整图重建"可以分帧/并行，是方向 A 能快起来的原因。
- **推荐组合（A+ 最小子集）**：主题地图若干张，每张 = 种子 + 地形常量表 + 图集格位；传送门遮罩（站桩 2–4s + 噪声 + 音效 + 白渐变/vignette 收尾）；进门瞬间把目标图 chunk 包发 mesh-worker 预构建；切换完成后新图 chunk 淡入；上一张图 mesh 保留 1–2 格 LRU（原路返回零等待）；IndexedDB 只存种子与玩家改动。全部手法见 §5 速查表 #1–#15。

## 7. 证据局限（诚实声明）

- 战神 2018"窄缝/电梯是其流式遮罩载体"未找到 SMS 工程师逐字自述，属二手共识（§2.1 已标注弱来源）；其"零加载屏、无黑屏渐变"有一手（Wikipedia 综合 + Barlog 采访 + GDC 2019 演讲清单）。
- BotW 神庙进入动画"覆盖加载"是观察性结论（进入仪式与独立地图的事实有一手 GDC 演讲背书，但"动画时长=加载时长"未见任天堂自述）；血月释放内存为社区共识（Zelda Dungeon Wiki）。
- Krunker 的加载体验描述以官方 changelog（一手）+ 社区地图文档（二手）拼合，无官方技术博客。
- 本报告未运行任何性能基准；§3 的内存/网格体积为【推算】，落地前应在目标设备（低配笔记本/平板）实测。
