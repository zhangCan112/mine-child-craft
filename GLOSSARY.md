# my-craft-demo · 体素注意力训练游戏

为 6 岁孩子构建的我的世界风格游戏：竞技、解谜、建造玩法，以及基于五维实证范式的专注训练营（详见 MISSION.md）。

## 语言

### 大分块

**引擎层（Engine）**:
不含玩法与政策的可复用底座：体素模型、物理、网格化渲染、输入、特效、场景搭建工具。引擎不知道任何具体玩法。
_Avoid_: 底层、框架、核心库

**体素模型（VoxelModel）**:
方块世界的数据与规则：存取、碰撞、物理、射线。不含渲染——渲染是它之上的 adapter。
_Avoid_: 世界数据（仅指 Map 本体时可用）、引擎核心

**流体核心（FluidCore）**:
引擎层纯核心（js/fluid-core.js，零 THREE·零 DOM·有单测）：MC 液体的计划刻模拟——每格 `{源?, 水位 0-8}` 存**并行水位面**（voxel.js 的 fluidLv，与 worldCells 同布局，ADR 0004；编码沿用 MC liquid_depth：0=源、1-7 流动渐弱、8=下落柱，渲染高度=水量/9、上方同流体=整格）。队列按排程序（入队序）驱动、零墙钟——同编辑序必同终态（确定性重放红线）；步进=非源先重算水位（断供→消退）→ 下落优先（不耗水平距离）→ 坡向寻路侧铺（四方向 4 步内找洞取最短，只朝最低方向）；流入目标结算：异流体→混合表（圆石/石头/黑曜石）、thin→冲毁（掉落归装配层）、空气→源再生判定（水可成源=无限水，岩浆不可）。界外一律不可流入（世界底/图界不渗透）。装配在 world.js（编辑挂点与方块级联同面 / pumpFluids 每帧计划刻泵 / activateFluids 装场全场激活 / setFluidEditSink 模式存档账本缝）；玩家水内物理（浮力/溺水/岩浆伤害事件）在 voxel.js physics，HP 结算在模式层。参数表 config FLUIDS+FLUID（水 5 ticks/7 格、岩浆 30 ticks/3 格全球一套）。设计权威 docs/liquid-design.md（附录 B 逐条登记与 MC 的差异），调研底座 docs/mc-liquid-research.md。
_Avoid_: 流水系统/水物理（散称）、把水位编进方块 id 段（已否决的候选，见 ADR 0004）

**方块级联（Block Cascade）**:
编辑后世界自洽的引擎能力（js/cascade-core.js 纯核心 + world.js 两编辑入口装配，docs/block-lifecycle-design.md 是设计权威）：破坏一个方块后依身份旗标连锁结算失撑方块——原木组件**接地判定**（砍一节=整树倒、挖脚=结构倒、双柱桥断一柱仍立）、**树桩连带**（P15：被移除的原木正下方同柱残段一并倒——砍任何一节=整树倒，横向结构脚下非同柱不受牵连）、树叶失依而落（taxicab 4 内无原木）、thin 依附块随底座脱落（火把/树苗/草丛）、沙子**重力下沉**（二期 D7：连续段整体下移=移动语义，落沙砸碎沿途依附块、穿水沉底，放置半空即落）。**身份原则**：判据只读 config BLOCKS 旗标（fell/need/thin/fall），不含任何位置/模式条件——石头无旗标在哪挖都不塌，是树就倒（孩子搭的原木柱与自然树同规则）。触发面：破坏全旗标；放置仅 fall（原木/树叶/thin 放置永不触发——建造装饰保护）。**世界卫生清扫**（P14/D9）：探险 init 重放 edits 后全图治愈既有浮空违例（孤儿叶/悬浮树/浮沙/悬空依附块），不动点迭代、逐块记 edits 幂等、静默无掉落（装场期迁移不是游戏事件）；建造模式不清扫。editBlock/editBlockDirty 返回级联清单——{x,y,z,id}=移除（掉落/任务照常），带 to=移动（方块存活，**记账必须两格**：原格 0+落格 id，触发格先记移动后记，漏格/错序重进即错位）；引擎只报事件，掉落/记账/话术是模式政策。观感为纯 overlay（落块 Fx.fallBlock/碎屑），数据永远即时结算（确定性重放红线）。
_Avoid_: 倒树系统（树只是第一个消费者）、物理引擎（无刚体无连续力学）、把级联政策（掉落/任务）写进引擎

**场景装填（loadScene）**:
world.js 渲染 adapter 的建场 seam：loadScene(buildFn) = 清场 → 批量建 → 收尾入队一步到位。"建完必须 rebuildAll 否则整场不可见"的收尾纪律收在 seam 里（曾有模式漏调，进场一片天蓝）；收尾是渐进的——全部区块按距玩家距离入距离环队列（近处优先），由 pumpRemesh 每帧按预算构建，进场先见脚下、远景数帧铺满。清场幂等。编辑管线同理由 pumpRemesh 自动收口脏区块——漏调 flushDirty 最迟下帧入队，不再永远不可见。
_Avoid_: clearWorld+build+rebuildAll 三连（历史惯用套路）、手动 flushDirty（即时提交的可选优化，不再是必需）

**世界改动日志（WorldJournal）**:
应用层纯核心（js/world-journal-core.js，零 THREE·零 DOM·槽/世界写入口/时钟全注入，有同名单测）：体素世界「玩家改动账本」的存档深接口——edits 差异账记账（`"x,y,z"→id|{id,lv}`，逐格最后写赢）、脏标、5s 节流落盘（墙钟口径）、关页兜底（pagehide 同步写）、双通道重放（流体格 `{id,lv}`→setBlockRaw+setFluidLv 两笔，裸值→方块一笔）五件事收进 `mkWorldJournal(slot, opts)` 一个工厂；档形政策全经 opts 注入——payload 装档（探险六键 pos/hp/furnaces/livestock/dayTime/netherEdits——末键为下界分桶，2026-10 下界并入；建造 scene+按场景分桶）、onFlush 伴随联写（背包/任务档在主档后）、overSize 超限守卫（建造 190KB toast）。`fluidCell(id, lv, blocks)` 是流体格编码判据的唯一权威（fluid 旗标→`{id,lv}`，lv0=源；其余裸 id，旧档零迁移）。消费方只剩缝上的适配器：探险的站点缓存/挖炉退包留在 advMarkEdit 顺路做，建造的分桶 `{sceneId: Map}` 经「当前桶换装 journal.edits」吸收。互锁红线：同一份 edits（含流体格）经两形状适配器重放后世界状态必须一致（test/world-journal-core.test.js 对症断言）。
_Avoid_: advEdits/buildEdits 直接当账本误以为还有模式层实现（历史形态——两份镜像已收编，模式文件里只剩 journal.edits 的引用）、把流体格编码 `(BLOCKS[id]&&BLOCKS[id].fluid)?{id,lv}:id` 誊写回消费方（判据单份在 fluidCell，源文本守门）、在 journal 里写探险/建造任何一方的档形政策（payload 分叉是刻意设计）

**昼夜核心（DaylightCore）**:
引擎层纯核心（js/daylight-core.js，零 THREE·零 DOM，有单测）：MC 同表的一日 24000 tick 时间轴（tick 0=06:00 · 6000=正午 · 12000=日落开始 · 18000=午夜）与全部派生量的纯函数单一权威——时间推进回绕 advance（dt 秒 ×20 tick/秒，一日回绕）· 天空暗度折线 skyDim（0..11，DIM_KEYS 五点分段线性：正午 0→夜 11→次日 0）· 夜晚判定 isNight（[13000, 23000) 简化口径，MC 精确值 13188/22812——差异 #15）· 内部天空光 internalSky（遮挡列天空等级随时间再衰减，负值钳 0）· 渲染亮度 renderBright（0.05+0.93·(l/15)^1.6 三锚点拟合 0→5% · 4→17% · 15→98%，差异 #14）· 天空染色 skyTint 与天色 skyColor（白日↔月光蓝/深夜蓝按 skyDim/11 插值，黄昏橙不做）· 睡觉窗口 sleepWindow（精确 tick 界 SLEEP_A/SLEEP_B=12542/23460——线性折线在 12542 处 dim≈3.39 取不到 4，skyDim 派生口径会偏约 45 秒，故入常量表不经折线派生）。常量表 DAYLIGHT（TICKS/NIGHT_A/NIGHT_B/SLEEP_A/SLEEP_B/DIM_KEYS）。数值权威 docs/mc-daylight-torch-design.md §2（MC 数值依据 docs/mc-daylight-torch-research.md）；消费方 world.js（场景驱动：天色/雾/日光强度/日月轨道）/main.js（主循环推进）/modes/adventure.js（dayTime 存档与 HUD 时段行）——时间何时推进（暂停不推进）、何时入夜刷怪是模式政策，核心只算数。
_Avoid_: 昼夜系统（散称）、把折线/窗口判据散写回消费方（派生量语义单份在这里）、在核心里碰 THREE/DOM（场景接线在 world.js）

**光照核心（LightCore）**:
引擎层纯核心（js/light-core.js，零 THREE·零 DOM，有单测）：MC 双通道体素光场的算法唯一权威（docs/mc-daylight-torch-design.md §3）——方块光（光源发射级 1..15 六邻 BFS，曼哈顿每格 −1）与天空光（列顶直灌 15 至首个挡光块，横向/向上每格 −1——垂直下落不衰减已被列直灌包含）。挡光规则 opaque=实心且非玻璃（玻璃/水/薄块/十字片全透光不衰减，差异 #7）；挡光格两通道恒 0，唯光源格例外（自亮不透光，MC 灯口径）。interface：mkPolicy(BLOCKS)→{lightOf · opaque}（config 派生装配一次，world.js 与单测共用同一装配防两份漂移）· computeAll（全量：装场一次写满）· updateEdit（增量：方块通道增/撤两趟 BFS；天空通道 x±14 × z±14 列带区域重算——两趟扫描防读未处理列顶，返回脏格包围盒供脏盒记账；保不变量「增量累计 === 全量重算」）。光场契约：sky/block 为 Uint8Array(W·D·H)，布局 idx=(y·D+z)·W+x 与 voxel.js cellIdx 同式（布局即契约），updateEdit 直接读写一体（撤光必须读旧值）；光场存储在 voxel.js，经 packChunkData 光照圈喂网格化核心烘 aSky/aBlock 顶点光。逻辑亮度=max(internalSky, blockLight) 是消费侧口径，本核心只产出两个独立通道；依赖零全局（read/W·D·H/BLOCKS 全部参数注入）。
_Avoid_: 光照系统/光照引擎（散称）、把传播/撤光算法写进 voxel 或 world（算法单份在这里：存储在 voxel、烘焙在网格化核心、场景接线在 world）、光衰减与挡光判据散写第二份（mkPolicy 是唯一装配缝）

**网格化核心（MeshCore）**:
区块数据 → 顶点裸数组 的纯变换（js/mesh-core.js，零 THREE · 零 DOM，有单测）：全细节四通道（实心/玻璃/TNT 贴图/贴图图集——atlas 布局经 opts.atlas 注入，与 tntTiles 同惯例，未注入时入集方块回落纯色通道）与 LOD 降采样粗网格（每 lodStep×lodStep 列合并采样，顶面+裙边）。输入是体素模型的 packChunkData 打包（含邻块边界圈供跨区块剔面），hashRand 由调用方注入——同一份代码在主线程（同步兜底）与网格 Worker（http 服务主路径）里运行，布局即跨线程契约。
_Avoid_: 网格生成器（散称）、把 THREE 装配混进纯核心

**贴图图集**:
程序化 16×16 像素画风方块贴图的图集（js/texture-atlas.js，引擎层）：新方块 36~50 全量（四矿嵌斑/草丛/耕地/麦四阶段/工作台/熔炉/火把/树苗/黏土）+ 存量基础方块升级款（草顶/泥土/石头颗粒/圆石/木板缝/木头年轮树皮/树叶孔洞/沙子），像素全部自绘（零外部素材，MC 观感语言逐块手调）。像素先写进纯数据缓冲、画布只是惰性壳——Node 可逐像素直测；噪点/斑点用种子化伪随机，同 seed 同图（重进世界观感逐像素一致）。layout（方块 id→格号）是网格化核心的 UV 契约：经 opts.atlas 注入（与 tntTiles 同惯例），Worker 侧 importScripts 共读；未入集方块（下界系/羊毛/装饰）仍走 faceColor 纯色兜底。interface：layout / count / paintAll / tileUV / makeCanvas。
_Avoid_: 材质包（那是外部素材，这里全部程序自绘）、把图集布局散写在渲染层（layout 是唯一权威）

**距离环（Chunk Rings）**:
近实远虚的渲染预算分配（world.js，参数在 config 的 VIEW）：环心=玩家（驾驶中=坦克）——全细节环内实时构建完整网格，LOD 环用降采样粗网格（成本 ~1/lodStep²），更远卸载（GPU 释放、体素数据保留、走近重建）。环形态在消费端决定（pump 出队时按当前距离选 full/lod，走远的惰性丢弃），入队侧只登记缺口；编辑永远优先于环填充。
_Avoid_: 视距（那是渲染边界=雾，见 VIEW）、把卸载叫删除（数据还在 worldCells）

**Fx**:
特效的唯一入口：爆炸组合、冲击波球、闪电弧（arc）、落雷（bolt，盒段拼装的粗闪电）、碎块、震屏。条目形状与动画是它的 implementation，调用方不可见。
_Avoid_: effects 数组、震屏变量（那是内部状态）

**声音清单注册表（AudioRegistry）**:
游戏声音清单的唯一权威（js/audio-registry.js，纯数据+纯函数，有单测）：SFX 条目 `kind → {file 样本 + synth 合成回退, g/gTouch 双端增益, prio 抢占优先级, coolMs 同类冷却}`、BGM 曲目表（file/mood/g/durMs——durMs 是判曲毕的唯一依据）、主菜单情绪 MOODS（仅 `menu: 'calm'` 一键——各游玩模式的情绪唯一权威在 mode-registry 各行 mood 字段，镜像键已删）。标 file 走样本、无 file 或加载失败自动落条目内 synth——file 与 synth 互锁「永不哑」（A2 的「二选一」口径已作废）；TNT 下线死键（引线嘶声/铁门/水花）不迁入。加一种音效 = 这里改一行数据，播放器不自持清单；手滑防线在 test/audio-registry.test.js：扫 js/** 全部 `sfx('…')` 字面量 ⊆ SFX_KINDS 键（漏登记即红）、素材文件存在且 assets/audio/CREDITS.md 双向覆盖（正向=注册表引用必记载，反向=目录内文件漏记即红）。
_Avoid_: SFX_DEFS（历史名——effects.js 的音效段自带合成定义表，已迁入并降级为条目内回退）、音效表/曲目表（散称——三张表同属一个注册表）

**音频核心（AudioCore）**:
音频系统的纯决策核心（js/audio-core.js，零 THREE·零 DOM·零全局可变依赖，时间与随机由调用方注入，有同名单测），藏住「何时允许一声 / 何时起停音乐」：mkVoiceGate 发声准入——活跃数未满放行（触屏 ≤8 / 桌面 ≤12）、满员时新声 prio 严格大于最老活跃声才抢占（victim 恒为最老、供停声）、同类冷却窗内忽略；mkMusicDirector BGM 稀疏调度状态机——tick 吐 start/stop/gain 纯数据事件（解锁后 5~30s 起曲、曲毕随机 60~180s 静默、换情绪 1.2s 淡出后 15~45s 起曲、同 mood 续播不打断、duck 让路）；mkVolState 音量滑杆状态（baseline() 双端基线快照是装配层取基准的统一口径）；musicBusTarget 音乐总线目标换算——duck 让路只降不升（上限 0.08，不把压低/静音的总线抬响）；AUDIO_MIX 儿童保守响度常数表。WebAudio 节点的真实启停不在此——在 AudioMixer。
_Avoid_: 限声器/调度器（散称——准入与调度是两个工厂一个核心）、把决策逻辑写进 audio.js（那是执行层 adapter）

**确定性随机核心（RandCore）**:
全仓种子确定随机的唯一实现（js/rand-core.js，引擎层纯核心，零 THREE·零 DOM·有单测）：mkRand 同常数 LCG（seed 缺省回落 Math.random 的既定口径——不回落则首步 NaN、掉率虚涨 100%，NaN 回归防线）；shuffle 非突变拷贝式 Fisher–Yates（rnd 注入，入参不动、返回洗好的新数组，原地用法赋值回原变量）；seedAt 索引派生（base*7919+i*101+(j||0)+13，j 缺省 0——关卡/小节种子统一口径，2026-10 归一三套历史公式：math.js 的 i*7919+13、math-track.js 的 i*7919+si*101、math-build-world.js 的 seed*31+idx*101+7）；childSeed 从父随机流派生子种子（值域 [0, 2147483646]，喂给 PuzzleCore/BuildWorldCore 等以 seed 为入参的生成器）。interface：mkRand(seed?) · shuffle(rnd, arr) · seedAt(base, i, j?) · childSeed(rnd)。
_Avoid_: mkLootRand/mathLootRand/mRand/pzSeed/shuffleArr 等各文件本地副本（历史名——五份 LCG 四份洗牌已归一）、把派生公式散写回消费方

**AudioMixer**:
js/audio.js 的引擎层门面，全部声音的唯一出口：AudioContext 生命周期（手势解锁、interrupted/回前台恢复、挂起不排队）、双总线音频图（音效/音乐分账，触屏音效前置 ~160Hz 高通——音乐低频是内容不滤）、样本懒加载缓存与合成兜底解释器、坦克引擎嗡鸣、MusicDirector 事件流到真实节点的执行、duck。interface：`AudioMixer{sfx, engineHum, setMood, setMusicVol, setSfxVol, duck, tick, preload}`；全局 `sfx(kind)`/`engineHum(level)` 签名不变（60+ 调用点零改动）。决策在音频核心、清单在声音清单注册表，本门面只装配与执行。
_Avoid_: effects.js 的音效段（历史归属——sfx/engineHum/unlockAudio 原住在那里，A4 已整体迁出，effects.js 只剩视觉特效与 toast）、音频系统（散称）

**SpeechKit**:
全游戏共用的语音 interface：speak 与 cancel。声音挑选与播报策略收在它的 implementation。
_Avoid_: focusSpeak（历史名——语音已不属于专注子系统）

**头顶血条（mkHpBar）**:
玩家战斗 kit 的血条深接口（C6-T3 自 mode-kit 迁入 js/combat-kit.js）：canvas 贴图 Sprite，update(hp,maxHp,x,y,z) 惰性建条、血量变化才重绘（逐帧纹理上传是移动端掉帧源），可选 visible() 回调控制显隐（能力面保留；历史口径「下界只在下界显示」已随下界模式退役）；dispose 收网格与纹理。曾为下界/探险两模式的同形实现归一，2026-10 下界并入探险后唯一消费方是探险——上界/下界两相位恒显，模式层只喂血量与世界坐标。
_Avoid_: ensureHpBar/updateHpBar（历史名——两模式各自的内联实现已撤）、把它留在 mode-kit（战斗 vocabulary 已归 combat-kit）

**玩家战斗 kit（CombatKit）**:
应用层装配（js/combat-kit.js，THREE/DOM 惰性，有契约单测）：玩家战斗壳的归一——曾为下界/探险/坦克演习场三模式各自复制的同形实现，现消费方 = 探险（下界并入后唯一玩家战斗消费者）+ 坦克演习场（仅击杀观感）——mkFighter 玩家战斗实体（MobCore 状态字段 + 政策注入，原 getPEnt/advGetPEnt 同形）、mkHurtAlarm 受击提醒（账本同步 + 音 + 闪红 + 震屏 + 3s 话术节流，节流自持）、mkMelee 近战（准星锥门槛可选/swingOnMiss 下界无目标也出手口径/swingAction 弓占同一冷却轨道、冷却自持、伤害函数/耐久磨损/击杀经注入）、mkArrows 箭矢管线（一实例一弹种：发射 leadAim/沿准星 → 战斗核心 stepShot 步进 → 命中政策回调，弹数组与 geo 缓存自持）、killBurst 击杀观感（碎块 + 计数 toast + 尾回调，动词可注入）、resetFighter 复活五字段不变量、mkHpBar。interface：`CombatKit{mkFighter · mkHurtAlarm · mkMelee · mkArrows · killBurst · resetFighter · mkHpBar}`；行为面由 adventure-mode 既有断言兜底（interface 即测试面；nether-mode 断言已随模式退役删除）。
_Avoid_: getPEnt/advGetPEnt/netherOnHurt/advOnHurt/netherShoot/advShootArrow 等模式内联实现（历史名——已归一至 kit 实例；nether* 前缀各名已随下界模式退役）、把怪物 AI 骨架塞进来（激怒/归巢/飞行/封顶/供怪五维策略差异留模式层）、战斗冷却/节流状态放回模式顶层（kit 自持，update 只喂 tick）

**训练营壳 kit（CampKit）**:
应用层装配（js/camp-kit.js，THREE/DOM 惰性，Node 测试可安全加载）：focus/math 两训练营模式壳机器的收编地——两模式文件 ≈500+ 行换前缀镜像复制的归一（治理候选 1，四票收编，拍板记录见 docs/camp-kit-unification-design.md）。**已收（候选 1 收官）：T1 战利品回路五件套 + T2 图章仪式四件套 + T3 家长门/迷你折线/CSV 下载仪式/结算星显+自动续程 + T4 壳骨架（ensureRoot/screen 挂屏/exit/init/cleanup + 停止钩子注册表 + 存档槽三件套与预算访问器 + pickLine 话术随机取行件）**。T1：mkCampTicker 训练时长 ticker（每秒 accrue 实际毫秒 + 单拍钳制 2s——f3c1fee 修复语义单份保真：只认连续在场的真实训练时长，后台挂机不灌入每日预算；start 幂等/stop 复位）；mkLootHud 矿袋战利品 HUD 一实例一家族（grantIntoBag 经 CampCore.grantLoot 入包 + 入包即 save（ADR 0002）+ 满包每关至多一次 onFull 回调、noteTap 飞行起点记录、fly 贝塞尔弧线飞入（含 HUD 宽度守卫——隐藏即放弃观感，入包已完成）、addSlot 落袋并槽计数、recapHtml/runRecap 结算列队回顾、begin 每关会话开张、clear 模式 cleanup 清场），会话状态（入包明细/满包节流旗/最近点击）自持实例。T2：mkStampRites 图章仪式一实例一家族（calendarHtml 本月日历条——当日 min/big 章线、30 章金章常驻、家族角标经 badge 缝注入；awardHtml 授予仪式块——喝彩图经 awardIcon 缝注入，有图文本包进 {p}-award-text、无图裸文本；wirePicker 三选一图案选中即写档+高亮+sfx+TTS 读章名；firework 一次性 CSS 粒子迸发挂根容器；kindOf 损坏存档回落家族缺省章），章白名单/章名表/缺省章/当日章线/日期键/计数/奖励线→文案/写档/根容器访问器全部经 opts 注入（数值表留各自 levels）。T3：mkParentGate 算术门一实例一家族（两随机数∈[5,9] 加法、干扰项 ans+1..3 与 ans-1..3 下限钳 2 与正解恒不撞、经 RandCore.shuffle 洗牌（Fisher-Yates 不偏分布）、parseInt 比对，答对 onPass 开面板/答错 onFail 零羞辱静默回落；渲染经 screen 缝、按钮查询范围经 scope 缝注入）、sparkSvg 迷你折线（W120×H36/#7cfc00/2px 两侧同参；数值域 max=100(focus)↔1(math) 与空态文案经 cfg 保真，同点位换算恒等）、downloadCsv（BOM+Blob+click+5s revoke 仪式件，行构造留家族面）、mkSettleBits 结算件一实例一家族（starSpans 三星行/popStars 350ms*n 逐星 pop/armAuto 自动续程计时——时长 4000(focus)↔4500(math) 经 autoMs 保真且可逐次覆盖（focus 里程碑串播复用同一轨道）、clear 供换屏与 cleanup 收口）。家族差异全部经工厂入参注入：budget 预算访问器、f-/m- DOM 前缀（CSS 契约不变）、defaultOrigin 缺省飞行起点（focus=训练区矩心兜底常量/math=屏心，参数化保真两侧现状）、onFull 满包回调、badge/awardIcon 两道观感缝（focus=魔鬼特训鬼图章角标+村长喝彩图，math 均无）。T4：mkCampShell 壳骨架一实例一家族（ensureRoot 惰性建根——math 的根级 pointerdown 自记点击经 onRootPointerDown 缝、bindRoot 回写模式层根变量（mathRoot 是 math-world/track/build-world 三处直读的跨文件契约）；screen 挂屏——换屏清自动续程 + onScreen 钩子（math 停常驻钟）+ headerExtra 屏头附加缝（math 钟面容器）+ 返回钮接线；exit/init/cleanup 骨架——init=建根→initPre（focus 矿洞皮肤）→显示→收 overlay→共享背包读档（ADR 0002 重进必重读）→initPost（首屏/focus 补授仪式），cleanup=停止钩子→停 ticker→战利品清场→续程收口→静音→藏根；**onStop 停止钩子注册表（「退出收口权」核心 vocabulary：模式专属停止件自注册，exit 与 cleanup 都跑——挂钩件的可达状态保证恒等：focus 的 abortDevilRun 在退营路径不可达必为 no-op）；存档槽三件套与预算访问器一并收编（saveKey/saveDefaults/saveMigrate/budgetName 注入，SyncDB.slot 同构件）**）；pickLine 话术随机取行件（两侧现状均为均匀随机，无防重复/游标；话术表本体是家族面留 modes，全局名 praiseLine/comfortLine/mathPraiseLine/mathComfortLine 是引擎调用契约不动）。interface：`CampKit{mkCampTicker · mkLootHud · mkStampRites · mkParentGate · sparkSvg · downloadCsv · mkSettleBits · mkCampShell · pickLine}`；ticker 钳制与授予/节流账目、图章 kindOf/仪式块两分支与角标缝、家长门题面/接线、折线数值域、星显与自动续程时长有单测（test/camp-kit.test.js），DOM 观感件不直测（仓库惯例），行为面由 boot 冒烟 + math-paradigms 流程断言兜底。
_Avoid_: 把两训练营的 HUD/计时/授予复制体当独立实现（历史形态——已收编 kit 实例，模式层家族名是薄委托）、把家族政策写进 kit（段位变率/族池掷骰留各自 levels；连败换路 unlocked 推进 vs 0 星占位是存档政策分叉、今日页/onLevelEnd 结算流程是家族面，均留 modes；focusStreakChimes/focusLootDry 奖励调优专属计数留 focus 模式层）

**模式面板 kit（ModeKit）**:
应用层 shell 服务（js/mode-kit.js，DOM 惰性、假 doc 可注入单测）：服务面向引擎 chrome/HUD/物品面板族的**游玩模式**（竞技场/建造/坦克演习场/探险）——mkMode 模式壳装配（chrome 显隐/每帧 HUD 文本（hit 由主循环注入）/触屏动作声明/KeyB 默认暂停/坠虚回最近出生点兜底/onPageHide 关页兜底存档钩子——白名单透传，main.js pagehide 收口分发，世界档 5s 节流的模式借此在关页时同步落盘，2026-10 探险树苗丢档修复引入）、mkHotbar 快捷栏（digit/wheel/点选选块全自动 + 物品槽像素图标+计数+耐久条）、mkMainAct 触屏主动作键（手持感知分派：手持可放置物按下=放置一次且不进连发、空手/工具=打/挖起步连挖）、editHit 挖/放编辑原语（2026-10-26 建造/竞技场镜像收编：button 0 挖=世界底层 y0 守卫+儿童话术（原建造私有守卫升格共享，竞技场随之补齐）· 2 放=placeId 手持感知+目标格空置+不与玩家碰撞三重守卫沿命中面法线落位；返回 {x,y,z,id,removed}（removed=级联清单）或 null，存档记账/掉落政策留消费方）、mkHoldMine 触屏按住连挖驱动（250ms/块与桌面单击同路；onHold 起止+每帧 step、准星长按跟随指尖、指空/底层静默——建造既有样板收编，竞技场「注释宣称连挖却无实现」的缺口同批补齐；fire(hit) 注入挖路径，桌面不触发）、mkCraftPanel 合成面板（配方书卡片 + 摆放台 + 背包格点选搬运，无拖拽；合成两步制：点卡=fillGrid 一键备料、点产出槽执行——单击一发/长按 0.4s 进连做，2026-10-26 用户拍板防误合）、mkFurnacePanel 熔炉面板（三槽 + 进度/燃料条 + 常驻背包区手动放入：18 主格 + 9 快捷镜像点击报 onPut 意图，可烧/燃料物亮显、其余 dim 灰显；点炉三槽报 onSlot 意图取回/收取——路由与扣加在 FurnaceKit）、mkChestPanel 大宝箱面板（全局账户点选搬运 + 三档扩容行）、sortInv 整理底座（主格区同项合并）、mkHeldSync 手持感知同步件（调色板+'shovel' 哨兵槽+数字方块判定+Avatar.setItem+主动作键图标切换五件套收编——竞技场/建造两消费方，哨兵语义藏实现，消费方只见 isBlock/itemId/sync）、mkMobPicker 选怪按钮组（Mobs.face 头像+名字+families() 谱系分组簇+active 高亮的按钮制造术收编——竞技场双队面板/演习场浮动面板/出发配置页怪物行三处誊写归一，差异经 opts：headKeys/groupOf/itemTag·itemCls·itemHtml/titleOf）、spawn/lookName/confirmBtn 工具件。三面板（craft/furnace/chest）共用**内部底座 mkPanelShell**（不对外，2026-10 面板骨架三份誊写收编）：遮罩/头/✕/背包格区（18 主格+9 快捷镜像）双循环/格子渲染/Esc/开合生命周期收编一处，面板=底座+差异段（craft=摆放台+配方书+整理钮+关面板退料；furnace=三槽+进度/燃料条+不可入炉物 dim；chest=箱格+扩容行）；refresh 语义统一=重画内容不碰开合态（复明归 show）；内部卸载名 unmount（对外成员仍 remove——摆放台槽级取走裸调 remove 不再被同名遮蔽）；摆放堆叠上限经 stackMax（64 魔数已清零）；图标/格子/材料 chip 渲染收口 kitIconHtml/kitCellHtml/kitChipHtml；三面板同吐 `cellAt(背包槽号→栈快照)` 只读查询面（测试不再爬 DOM 序）。mkHpBar 已随战斗 vocabulary 迁 CombatKit。interface：`ModeKit{mkMode · mkHotbar · mkMainAct · mkHeldSync · editHit · mkHoldMine · mkMobPicker · mkCraftPanel · mkFurnacePanel · mkChestPanel · mkBubbleBar · sortInv · spawn · lookName · confirmBtn}`。
_Avoid_: 把训练营壳件塞回 mode-kit（壳机器在 camp-kit——两 kit 分工：mode-kit 服务引擎 chrome/物品面板族的游玩模式，camp-kit 收两训练营壳）、kitSpawn（内部名——不占共享全局最裸的 spawn 一词，对外经 ModeKit.spawn）、三面板各自复制的面板骨架（历史形态——已收编 mkPanelShell 底座）、面板内 64 堆叠魔数与 globalThis.remove 绕行（历史写法——上限归 stackMax、遮蔽已随 unmount 改名消除）、arenaHeld*/buildHeld* 五件套（历史形态——已收编 mkHeldSync）、选怪按钮内联制造术（历史形态——已收编 mkMobPicker）、模式层自写的挖/放守卫三连与连挖计时器（历史形态——已收编 editHit/mkHoldMine；建造 buildHoldStep 本地副本已撤）

**熔炉装配 kit（FurnaceKit）**:
应用层装配（js/furnace-kit.js，DOM 惰性、假 doc 可测，有契约单测）：探险与体验馆两模式熔炉装配段的共享 kit（T4 票抽取——134 行镜像超 80 行升级扳机触发）——mkFurnaceStation 一工厂收编面板开合/取产物/自动放料/手动放料（背包槽整摞路由 + 异种整摞对调）/炉槽取回（料/燃料回包·产物即收）/逐炉推进喂显（三槽签名节流 + 产物槽 out→output 桥接——探险侧历史错位「产物槽有锭不显示」随抽取修复，契约测试锁回归）/挖炉退料/退场退炉/燃料余量比；烧炼状态机与退炉政策不在此——走合成核心纯函数（探险的炉与体验馆的炉是同一缝上的两个 adapter，不造第二份实现）。消费方政策全走 4 语义事件缝（2026-10 评审收窄，同一动作同一 reason 至多发一次）：onPanel(open)（指针配套；开态唯一真值是 station.isOpen()，消费方勿自抄镜像旗标）· onInvTouched(reason, posKey?)（背包被动过；reason 全集 collect/collect-full/autofill/manual-put/drop——'drop' 附带 posKey 供炉位收尾观感，契约测试锁死）· onRefundLeft（挖炉余量掉落物政策，与背包政策分缝）· onMade（烧成记账+TTS）；inv 两供给形态等价：背包对象（探险，引用跨 load 稳定）或取数器（体验馆，进场换新实例）。interface：`FurnaceKit.mkFurnaceStation(opts) → {map · panel · open · close · isOpen · at · state · ensure · autoFill(plan?, posKey?) · manualPut(idx, posKey?) 手动放料（背包槽整摞路由：可烧物→料槽·燃料→燃料槽·两性物优先当料烧；空槽整摞入炉/同种并堆/异种整摞对调（炉内那摞回源槽，无损不走 add）/不可入炉原样放回） · slotClick(name, posKey?) 炉槽点击（料/燃料整摞取回包、'out' 立即收取） · tick · drop · refundAll · reset · dispose}`。
_Avoid_: 把熔炉装配写回模式层（两模式镜像的旧形态已收编）、为 kit 造第二份烧炼实现（状态机归合成核心）、把探险持久化塞进 kit（世界档 encode/decode 留消费方）

**SceneKit**:
坐在体素模型之上的场景搭建工具：填充、种树、确定性散布。四个游玩模式（竞技场/建造/坦克演习场/探险）的场景构建共用它。
_Avoid_: fillB / plantTree / fxHash（历史名，已归并）

**画质核心（QualityCore）**:
触屏 DPR 自适应的纯决策核心：主循环每半秒喂一个 fps 采样——降档快（持续低帧 3 秒即降，不受冷却）、升档慢（持续高帧 30 秒且度过降档后 60 秒冷却才升）、45~55fps 死区不积累证据、升档观察窗（升后 60 个采样）内又降则该档本场封顶。interface：mk（按设备初始 DPR 建档，向下取整到 0.25 台阶）/ step（喂采样，返回新 DPR 或 0）。初始 DPR 拉满在渲染 adapter（world.js），换档的 setPixelRatio 施加在主循环，核心不碰 renderer；桌面端不参与自适应。
_Avoid_: 自适应分辨率（历史名——现在管的是画质档决策）、dprCap/lowFpsStreak（被取代的内联实现）

**触控手势核心（TouchCore）**:
引擎层纯核心（js/touch-core.js，零 THREE·零 DOM，有单测）：触屏指针流 → tap（轻点=放置/交互，作用于指尖）· drag（拖动=视角）· hold（长按，分类保留防静置手指误判轻点——挖掘/攻击已收进显式 ⛏️ 主动作键，长按当前无动作）三分类状态机，判据=按时长 × 位移阈值，一指一局互不串扰；到点升级（due）由调用方定时询问——纯核心不持定时器。手势底座按 MC 基岩版新触控口径（调研在 docs/mc-touch-controls-research.md，按钮策略经用户 2026-10-24 pinpoint 备注调整）；input.js 把 tap 分发为 aimClick(2) 于触点（CameraRig.holdAim 瞬态注入）。主动作键（holdAct：**手持感知智能分派**——手持可放置物按下=放置一次且返 false 不进连发（mode-kit 的 mkMainAct），空手/工具/铲子按下=打/挖起步、按住经 onHold 连挖；图标经 input.js 的 Input.refreshMain 随手持切换镐/铲↔砖块——旧散全局名 refreshTouchMain/refreshTouchUI 已随消费方收口撤销（adventure 走 Input.refreshMain、build 走 Input.refreshUI，2026-10-26），仅剩 setTouchActions 为 math-build-world 的过渡别名）与低频键顶部小键区（rare）同在 input.js 的按钮系统里。
_Avoid_: 手势识别器（散称）、把定时器塞进纯核心（到点驱动归调用方）

**相机装置（CameraRig）**:
玩家视角的唯一入口：视角模式（第一人称 / 第三人称背后 / 正面）、载具锚 mount（挂载后轨道换 CAM_TANK 车尾跟随，apply 恒返回 0，玩家形象按既有契约隐藏）、轨道距离与越肩偏移（人物落画面左侧，准心不被挡）、防穿墙收拢，以及统一的角色瞄准射线 aim（准星所指即所操作，且不瞄到人物身旁/身后）；触屏长按期间 holdAim 屏幕点接管 aim（眼睛穿过指尖发射——挖/高亮跟手，MC 触控"所见即所点"口径）。主循环只调 apply；瞄准不得从 camera.position 自行发射。
_Avoid_: 相机跟随、第三人称开关（那是它的 implementation）

**玩家形象（Avatar）**:
玩家的小探险家模型与动画：建模走造型档案（MobLookKit.puppet('player')——官方 8/12/12px 等比人形 + 64×64 自绘皮肤，身份件〔橙帽/背包/蓝衫/五官〕全画进贴图，旧 Q 版盒子建模已退役；**骨架名≠解剖学左右**：官方 bedrock 数据把 armR/legR 建在 −X 侧，怪物经 z 镜像（+Z 朝向）后 −X 恰为解剖学右手，玩家傀儡 −Z 原生不镜像、解剖学右手在 +X=骨架名 armL——Avatar 装配处按解剖学交换左右骨绑定，手持物/挥击恒在右手，2026-10-26 左手持物回归修复）、走路摆臂、头部俯仰、随相机距离显隐、受击闪红（flash：皮肤材质向红插值再淡出，模式层意图 API，观感能力不漏玩法知识）。加载即挂场景、跨模式存活；每帧由主循环喂 dt 与 CameraRig.apply 的返回距离，其余不可见。
_Avoid_: 玩家皮肤（那是官方素材概念，本项目皮肤程序自绘归造型档案）、人物模型（散称）

**玩家状态（PlayerState）**:
voxel.js 玩家段的六绑定 pos/vel（const 对象、成员可写、与 THREE.Vector3 鸭子类型兼容）与 onGround/yaw/pitch/flyMode（顶层 let）——共享词法环境里全仓可读。可写白名单的唯一权威在 voxel.js 玩家段头注释：physics 自身 · input.js 视角热路径（唯一属主+事件频率高于帧率）· math-world.js 自持 rAF（主循环物理门控的已知症状，治理归引擎「非锁定宿主驱动入口」未来票）· tank.js 引擎同侪四类例外。意图入口：传送/出生走 ModeKit.spawn（mode-kit.js，顺带记住出生点供 onVoidFall 兜底），飞行态走 setFly（voxel.js，切换清垂直速度）；模式文件零直写由 test/conventions.test.js 守门断言把口。combat-kit 的 mkFighter 把 pos/vel 可变引用别名进战斗实体——意图入口只原地改字段、不替换绑定。
_Avoid_: 把六绑定当模式可写状态（模式层直写已被守门断言拦）、给 setFly 加第二实现（语义单份在 voxel.js）

**手持物注册表（HeldItems）**:
手持物的唯一数据源：部件表、握持姿态、挥击与待机参数。两级供给——**defs 注册表**（手工武器 + 工具 16 条由 mkToolDef 加载期批量生成，工厂供单测直调）+ **defFor 惰性出口**（运行时唯一取 def 通道：工具/武器→defs；方块〔物品 id 或数字方块 id，建造/竞技场调色板直传〕→mkBlockDef 方块本体；棒状材料→mkRodDef；其余注册物品→mkPlateDef 薄片；空槽/未注册→null=空手，MC 口径）；附无状态入口——挥击关节角纯函数、按 def 的网格装配。加武器 = 加一份 def；肢体动画与握持施加收在玩家形象（Avatar）的 implementation 里，Avatar.setItem 声明目标、换物走「下沉-换-抬起」装备动画（沉到底才换网格）。
_Avoid_: 武器表、物品系统（合称——物品核心/背包核心/合成核心/掉落物实体库各归各词条）

**物品核心**:
引擎层纯核心（js/items-core.js，零 THREE 零 DOM，有单测）：物品注册表 ITEMS 是全游戏物品的唯一数据源（材料/放置型/食物/工具四类条目，加物品=加一行纯数据），外加四个无状态纯函数——stackMax 堆叠上限（未注册=0，即入包拒收门禁）· mkStack 造一摞（工具自带满耐久）· isTool 工具判定 · toolOf 工具五元组查询（D9 数值表）。icon 字段只是 emoji 占位，正式图标归像素图标工坊的 itemIcon/iconOf。不依赖 config——放置型的 block 字段存方块 id 数字，号段交叉校验在单测。
_Avoid_: 物品表（散称）、把背包规则写进这里（归背包核心）

**物品提示（ItemHint）**:
全游戏「这个物品是什么」儿童提示语清单的唯一权威（js/item-hint-registry.js，应用层·清单注册表，纯数据+纯函数，有单测）：点到什么读什么（语音+文字气泡）的话术数据与解析。ITEM_HINTS 物品键→一句儿童说明（键集必须与 ITEMS 全键一致，单测守门——新增物品忘写提示即红）+ BLOCK_HINTS 方块 id→说明（覆盖建造/竞技场调色板号段 1~19）；名字唯一权威在 ITEMS/BLOCKS，本表只补说明不复述名字；tts 拼装口径（有说明=名字+'，'+说明）收在此处。出口：hintForItem(id) · hintForSlot(槽描述符)（三型槽分支 + 空槽判空——item 型 cnt()≤0=没东西可介绍）→ {name, desc, tts} | null。触发面与装配在 mode-kit（模式层零接线免费获得）：mkHotbar.select（点选/数字键/滚轮统一漏斗）+ 合成/熔炉/宝箱三面板格子点击 + 灰配方卡点击（读产物+「现在还做不了哦」尾句，替代原先的静默无反馈）→ kitHint 气泡（div.hint-bubble 挂 body，3.2s 淡出，与 #toast 两条通道互不抢占）+ SpeechKit 语音（cancel-then-speak，最新一句优先）；解析与语音均经 typeof 守卫（精简装载的 Node 单测可缺装，静默无提示）。设计定稿 docs/item-hint-design.md。
_Avoid_: 在手播报（历史形态——探险模式仅工具仅文字的「X 在手！」toast，已随统一提示撤除）、把儿童话术写进 items-core（话术属应用层，引擎层不知道玩法的分层红线）

**背包核心**:
引擎层纯核心（js/inventory-core.js，有单测）：27 槽背包模型（槽 0~8 快捷栏直显 + 9~26 主格）与全部背包规则的单一权威——入包并堆/拒收、跨槽计数、按 cost 扣料（含任选材料）、槽级移除、点选搬运（moveSlot：空位整摞搬家/同物并堆/异种对调，工具耐久随堆不重铸——背包面板快捷栏↔主格腾位与快捷栏换序的底座）、工具耐久扣减、存档往返。耐久归零后的「消失+TTS 安抚」政策在模式层（D4/D9）。interface：mkInventory · add · count · canAfford · take · remove · moveSlot · damageTool · serialize · deserialize（附常量 HOTBAR_SLOTS/MAIN_SLOTS/INV_SLOTS）。
_Avoid_: 物品栏、inventory 对象（那是实现）、把扣料逻辑复制进合成（canAfford/take 的语义唯一权威在这里）

**合成核心**:
引擎层纯核心（js/craft-core.js，有单测）：合成烧炼的唯一数据源——RECIPES 全表（九宫格改造 crafting-grid 设计稿：随身 10 条摆 2×2 随身格随时可做 + 工作台级 27 条摆 3×3 摆放台需走近 4 格（含门/玻璃板，docs/door-window-design.md §2.4），拍板①②；条目带 shape 图案——rows 有序行数组/any 无序，格子规约=id 或候选数组〔煤/木炭任选=MC tag 口径〕，材料计费由 shapeCost 从图案派生不另存）· SMELTS 烧炼映射 · FUEL 燃料择优序（从 ITEMS 的 fuel 字段按热值降序派生）；外加无状态纯函数组——canCraft 背包预检（缺失清单三形状驱动配方卡亮灰）· matchGrid 摆放→配方匹配（口径全正典 minecraft.wiki：裁剪外圈平移+每行逆序水平镜像重试+无序多重集恰好相等，见 docs/mc-crafting-grid-research.md §2）· gridCraft 摆放台合成执行（RECIPES 数组序取首中、每占用格扣 1、产栈入包 leftover 零惩罚）· fillGrid BE 口径一键摆入（异物清扫+逐规约格并堆+1，重复调=再备一套）· fuelUnits 热值查询 · smeltOf 烧炼产物 · smeltStep 烧炼单步（每件秒数常量 SMELT_T 与表同居，2026-10 自探险核心迁入——步进政策与烧炼表同一权威）· furnaceRefund 退炉政策（满包余量清单，同批迁入）· breakTime 破坏时间（MC JE 正交口径：工具品类对即吃速度乘数、canHarvest 管 ×1.5/×5 系数与掉落；儿童封顶 8s 下限 0.15s；tier 不足可挖慢速但不掉落）。背包操作全部经背包核心接口，扣料语义不做第二份实现；旧 cost 计费自动合成 craft() 已退役（gridCraft 接棒）。interface：RECIPES · SMELTS · FUEL · shapeCost · canCraft · matchGrid · gridCraft · fillGrid · fuelUnits · smeltOf · SMELT_T · smeltStep · furnaceRefund · breakTime。
_Avoid_: 配方系统（散称）、cost 计费字段（材料量从 shape 派生）、craft() 自动合成（已退役）、网格拖拽（拍板②：点选搬运/点卡摆入，不做拖拽）

**掉落物实体库**:
引擎层的掉落物实体模块（js/drops.js）：顶层纯函数段——rollDrops 读 mob-registry 的 MOB_DROPS 掷骰（保底必得、50% 加成次数、rare 独立掷）· rollBlockDrop 读 BLOCKS.drop 三元组（可选第三参手持工具：剪刀 × shearDrop 存在时掷专属表——剪树叶得树叶方块，爆炸路径不传天然走默认表）· pickupCheck 拾取距离（≤0.6 收集 · ≤2.5 真空吸附），掷骰语义收在这里、表只存数据；壳段管实体生命周期——落地弹跳一次 → 贴地浮动+缓旋 → 2.5 格内加速飞向玩家 → 0.6 格触发收集回调（返回 false=背包满拒收，停在地上稍后再试）→ 3 分钟到期静默消失。图标经全局 iconOf（存在像素图标工坊则优先像素图）、emoji 兜底，本模块只消费不定义。
_Avoid_: 战利品系统（散称）、把掉落表掷骰写在模式层（语义归这里）

**像素图标工坊**:
手绘像素图标的工坊（js/icons.js）：16×16 字符画（字符查表上色，'.'=透明）→ 关平滑放大 64×64 → dataURL。tankIcon（主菜单坦克卡入口图标——emoji 各平台渲染不可控）+ 物品图标扩展 itemIcon/iconOf：ITEM_PIX 字符画数据表覆盖 ITEMS 全量（工具 16 条共用 4 张字符画，'#'主/'+'亮/'-'暗 三字符按木/石/铁/钻四阶色板替换，色板与 mkToolDef 同源），一期已全量替换 emoji 占位；iconOf 是物品图标统一出口——有像素图返 dataURL、未手绘返 emoji 文本、未注册返空串，掉落物 Sprite/快捷栏 item 槽/配方书卡片共用。怪物头像在怪物库，专注图标在 focus-icons.js。管线同形内联（mobs.face/tank icon 的放大尾、focus-icons 的 to96）是工坊声明的分地而非失控散写——底座化已裁决不做（2026-10，证据与重开条件见 docs/pixel-pipeline-design.md）。
_Avoid_: emoji 图标（各平台渲染不可控）、把图标绘制散写在各消费方

**按钮像素图标工坊**:
全游戏按钮/chrome 图标的唯一工坊（js/button-icons.js，应用层·图标资源）：16×16 手绘字符画走像素图标工坊同款管线（复用 drawArt/pixToURL64），替换全部按钮 emoji（⬆️📷⛏️🎒🧹✕🎵❤ 等——各平台渲染不可控）。语义与视觉语言对照 MC 一手来源逐条调研（docs/mc-button-icons-research.md，Mojang/bedrock-samples 逐像素取证：跳跃=上箭头+地面线、视角=立方体线框不画相机、心形 9×9 三色无描边、背包=褐色箱形容器；版权口径 D13——只取语义与观感语言，像素全部自绘）。委托不二画：物品系按钮（镐/剑/苹果/箱…）直接走 itemIcon 同一图源，坦克/苦力怕/鬼村长复用 tankIcon/Mobs.face/chiefFace。interface：btnIcon(name)→dataURL|'' · btnImg(name, cls)→img HTML · BTN_PIX（字符画表）· BTN_CARD_ICON（模式卡图标键表，注入走模式注册表驱动）。触屏按钮经引擎层 input.js 的 Input.icon seam 注入（引擎不反向依赖应用层，main.js 组合根接线，未注入回落中文文案）；静态 index.html 按钮（菜单卡/返回/音量/出发）由工坊加载期 IIFE 手术式换装（只动文本节点，不重建已接线的元素）；面板 chrome 图标在 show() 期注入（构造期工坊可能未加载——adventure.js 顶层建面板，boot 冒烟守此加载序）。防错网：test/button-icons.test.js 扫 js/** 全部 icon:'…'/btnImg('…') 字面量 ⊆ 工坊键集。
_Avoid_: 按钮用 emoji（观感业余且各平台字形漂移）、把按钮图标画进像素图标工坊的 ITEM_PIX（那是物品图标的地界）、在引擎层直连 btnIcon（必须走 Input.icon seam）

**探险核心（AdventureCore）**:
应用层纯核心（js/adventure-core.js，零 THREE 零 DOM，有单测）：探险模式的政策与地形段——地图常量表（湖/矿坑/山洞/巢穴/矿带）、确定性建场一族（advBuildWorld）、**下界段**（2026-10 下界并入探险，D15 剥核——常量表 ADV_PORTAL〔门框宽×高+传送冷却秒〕/ADV_NETHER〔平地顶层/回程门位/落点〕· advNetherBuild 下界建场〔平地下界岩+3×3 成片熔岩池，SceneKit.rand 修活 D17——退役前 hashRand>0.93 恒假从未长过熔岩〕· advPortalFrame 整座门〔set 注入缝：场景基座传 setBlockRaw，玩家放置传逐格记账 sink〕· advInPortal 门面 O(1) 判定〔脚/头格任一为 B_PORTAL，read 注入，玩家门与回程门同一条判据〕· advPortalSiteOk 放置校验〔包围盒全空气+玩家不入盒〕· advPortalExit 回程落点〔来向退 2.5 格+yaw 反向〕；设计权威 docs/nether-merge-design.md）、政策纯函数（死亡计划/巢穴节拍/挥击与怪物伤害/击杀掉落清单/收集播报/蓄力步进/放置合法性/食物政策/树苗计时/站点判定/炉存档校验/TNT 掷骰与衰减/大宝箱阶梯与入箱 advChestNext·advChestPut、政策下沉包（2026-10 评审候选 5，世界读/随机/动作全经注入 seam）：回小屋冷却 advHomeReady · 床边出生位选址 advBedSpot（方块读注入）· TNT 短按/按住二分纯步进 advTntTapStep · **级联清单→edits 账本的记账编排 advCascadeLedger**（存档红线件：移动两格先原格后落格、动作经 sink 注入，观感留壳）· 树苗长成足迹记账 advGrowMark（y..y+7/±2 界限=重进幂等关键）· TNT 半径遍历 advExplodeCells/波及清单 advTntWave · 闲逛节拍 advAmbleStep（随机注入）· 出箱 advChestTake（与 advChestPut 镜像））、任务表 ADV_QUESTS 与计数键口径、提醒政策三件（低耐久预警/背包快满/工具坏话术）。壳（js/modes/adventure.js）只留 mkMode 装配/THREE·DOM 观感/话术/生命周期（含切界换桶/天空/传送触发装配），经共享词法环境消费。地图行化（2026-10 生态地图）：巢穴池/夜怪池改为地图行缺省注入（ADV_HOME_ROW，advNestStep/advNightStep 签名零改动），ADV_QUESTS 扩远征章 10 条+解锁反查 advUnlockQuest；四图注册表与切图/门阵政策见「冒险地图」「传送门阵」词条。
_Avoid_: 把政策纯函数写回模式壳（S1 剥核先例：world→mesh-core / tank→tank-core / mobs→mob-core）

**冒险地图**:
应用层纯核心（js/adventure-maps-core.js，零 THREE 零 DOM，有同名单测）：探险模式多地图体系（home/desert/snow/swamp 四图）的数据唯一权威——**ADV_MAPS 注册表每行=一张图**：id · name/hud（HUD 图名行）· palette 调色板四元组（地表/植被/水/天基准色，RGB 0..1——壳 advApplyMapPalette 据此换天/雾/水色，先于装场：水色烘进重建网格）· build 建场函数（确定性零 Math.random，两次建场逐字节一致是单测红线）· nests 巢穴池 · nightPool 夜怪池（**替换语义**：整池换防不混刷——desert 无 zombie 有 husk / snow 无 skeleton 有 stray / swamp 无 skeleton 有 bogged+slime）· gates 门位清单 · livestock 畜牧分布键（四畜全套留 home）· swamp 行另带 witchHut 常驻标记；home 行并入探险核心的 ADV_HOME_ROW（巢穴池/夜怪池同一引用不复制），结构坐标的底层唯一权威在图常量 ADV_DESERT/ADV_SNOW/ADV_SWAMP（行的 nests/gates/witchHut 从图常量派生同引用，坐标不写两处）。政策纯函数：advMapUnlocked 门解锁判定（任务档 counts 键 ADV_UNLOCK_KEYS）· advGateHoldStep 门面站桩步进（2s 可反悔，状态进 {t,fire} 出）· advMapArriveAt(gate)/advMapArrive(row) 到达落点（回程门内侧 2.5 格、面朝外——advPortalExit 同口径）· advMapDeathPlan 死亡回家（远征图死=满血+home 门口）。**切图=壳层 advSetMap 唯一入口**（换桶→清场→行调色板→行建场+当前桶重放→出生→怪物重播→光束重锚；nether 期间不切图、保持最后主世界图）；存档按图分桶（世界档 edits 图桶 + 当前图键 map，含 nether 桶——老档裸 edits/两界档自动迁移）。设计权威 docs/adventure-maps-design.md。
_Avoid_: 生态群系/大地图（散称——一张图是一行注册表数据+一个建场函数，不是生物群系生成器）、把地图行数据写进壳层（行数据唯一权威在本核心，壳只消费；门位/巢穴/调色板同理）

**竞技场核心（ArenaCore）**:
应用层纯核心（js/arena-core.js，零 THREE 零 DOM，有单测）：竞技场模式的政策与数值段唯一权威——常数表（ARENA 几何〔中心由 config 世界尺寸加载期派生〕· HOTBAR 选块物品栏 · ARENA_POWER 配平战力 · ID_* 地形方块别名 · TIER_MULT/TIER_NAME 晋升档位〔1 档基础系数 2026-10 补齐〕· COUNTER 克制关系 · FLY_KNOCK_R/FLY_ORBIT_R 飞行边界两档 · MAX_MOBS 数量上限）· 叶子纯函数（angleLerp 环形角度插值 · mobSpeed 移速修正 · tierStars/tierHot 晋升星级名牌 · comebackMult 翻盘系数〔入参为双方总血量占比〕 · fusingCreeperNear 苦力怕合体探测〔入参为读条清单〕）· 配平三件套（unitPower/teamPower/balanceTeams，选边 lastEdited 与写回归壳）· 晋升阈值公式 promoThresholds · 击杀信用判定半 killCredit（观感半 levelUp 留壳）· 队伍血量占比 teamHpFrac · 编队池构造与抽取（mixPool/mixAvgPower/mixBuckets/pickMix，核心零 Mobs 依赖——spawnable 清单与 MOB_TYPES 由壳注入）· 地形段（floorBlock/wallBlock/generate）· 快照→意图段——索敌权重 retarget（输入候选快照+rand 注入；权重全玩法概念归应用层，不进 mob-core/combat-core）· 袭击协同计数 raidTick · 分裂决策半 splitReq（返回延迟队列条目）· 计时递减半 decayTimers（13 字段，光环呼吸留壳）· 判负判定半 battleEnd · 骷髅节奏两件 volleyDiv/skeletonHeavySwing · 阴风判定 ghostChill · 家传技能 tick 族（rageTick/burstTick/chargeTick/guardTick/blinkTick，统一信封意图 writes/tint/buff/shock/tp/fx·sfx 标签）· 晋升数值半 levelUpIntent（heal 基数=新上限，壳按 m.maxHp 算）· 击杀结算决策半 awardKillPlan（苦力怕特权转投）· 技能表 FAMILY_SKILLS/MOB_QUIRKS（声明式，tick 直引 core 函数；laser 旗标型 tickLaserCharge **拍板永久留壳**——它是壳的 vocabulary）· 分发 familyMain/familyTick/familyOnDead。统一口径：**输入快照→输出纯数据（字段新值、队列条目或意图信封），core 不碰 Mobs 实例与观感**，壳负责落回字段与 fx/sfx。依赖走 adventure-core 档：config（WORLD_W/WORLD_D 加载期求几何）· mob-registry（MOB_TYPES 调用期折算，2026-10 自 config 拆出）· voxel 的 hashRand/setBlockRaw 与 scene-kit 的 SceneKit 经全局名调用期解析，加载序在前，Node 测试先载四件再 require。壳（js/modes/arena.js）只留观感/编排/装配（战斗编排与移动段 · SKILL_FX 观感参数表与 landSkill 意图落回 · tickLaserCharge · 弹道与挂件 · 配平 UI 与会话状态 autoBalance/lastEdited/teamInitHp），经共享词法环境消费。
_Avoid_: 把观感挂件/弹道 mesh 写进 core（留壳）、tickLaserCharge 迁入 core（拍板永久留壳——状态机×三类意图×观感交织，它是壳的 vocabulary）、与 mob-core/combat-core 重复建 vocabulary（身体本能/弹道步进在那边，索敌权重是玩法概念归本 core）、把 lastEdited/autoBalance/teamInitHp 等会话状态搬进 core（选边与写回归壳）、core 反向写 Mobs 实例（快照进、意图出）

**训练营机制核心（CampCore）**:
应用层纯核心（js/camp-core.js，零 THREE·零 DOM·有单测）：两训练营家族逐字镜像机制的唯一实现——mkStampBook 图章一本工厂（rewards/keepDays/dailyCap 注入，30 步长递进线，八件 record/trim/count/milestones/rewardsDue/rewardFor/rewardClaimed/nextLine）、日期三件套 todayStr（委托 budgetDateStr 唯一拼装点）/dayIndex/trimLog（未来日期保留的零惩罚口径）、loot 基座 pickWeighted/grantLoot（余量静默+full 标记）；家族函数名（stampRecord/mathStampRecord 等）是 focus-levels/math-levels 的薄委托 interface；掷骰政策（段位变率 vs 族池）留各自 levels。
_Avoid_: 把两家族函数当独立实现（历史认知——机制已同源）、把掷骰政策塞进 CampCore（政策不对称是有意设计）、在 levels 之外再复制图章/裁剪逻辑

**背包壳（Backpack）**:
应用层薄壳（js/backpack.js）：全游戏唯一背包存档键的唯一持有者（ADR 0002——专注训练营接入物品系统后升格为跨模式共享背包，未来消费方必须经此壳，不得自开存档键；test/backpack.test.js 以键字面量守门）。interface：mkBackpack() → {inv（27 槽本体，引用跨 load 稳定）· load（原地换槽）· save}；背包规则全部归背包核心，本壳不复制。
_Avoid_: inventory_save 直开（消费方自建存档槽违反 ADR 0002）、背包存档服务（散称）

**载具（Tank）**:
引擎层的可驾驶实体模块：体素建模（含履带滚动/炮管后坐）、上下车状态机（toggle 返回 entered/exited/far）、相机锚源挂载、输入映射与开炮。坦克型号注册表（config 的 TANK_MODELS）驱动六款坦克（迷彩战车 · 沙漠之鹰 · 极地冰狼 · 熔岩勇士 · 雷霆战神 · 张廷彧号）：性能经 spec 透传坦克驾驶核心逐键回落基线，建模、炮弹观感（弹色/曳光/爆风）与像素图标（icon）各款一套；可选 salvo 齐射与 homing 追踪（转向数学在 TankCore.homeShell 纯函数，敌人坐标经 targeter 钩子注入）。interface：place（含 model 型号键）/ update / toggle / driving / nearby（返回 {d, name}）/ at（驾驶中车体状态快照 {x,y,z,yaw}，供碾压/索敌；不外泄可变物理状态）/ exitAll / clear / fire / onExplode / targeter / icon（另 protect 爆炸保护与 obstacle 炮弹障碍两个模式钩子）。model(key) 是型号查询的单一回落（未知键回落 classic 并告警，模式层不得手抄 || 回落）；模式钩子为会话级接线——clear() 只清实体不解除钩子，模式加载时注册一次即可。驾驶物理、炮弹弹道与爆炸破坏收在坦克驾驶核心（TankCore，纯核心：差速转向、惯性、履带爬台阶、最近车距门控、追踪转向、球形爆炸）；提示文案与话术在模式层。
_Avoid_: 坦克实体、载具系统、坦克皮肤（型号不止换色，性能/炮弹/建模整套不同）

**怪物库（Mobs）**:
引擎层的怪物实体模块：全怪物建模走造型档案（js/mob-look/&lt;type&gt;.js 一怪一文件〔官方像素骨架+自绘贴图，见「造型档案」词条〕——票③已拆内联骨架表与三票过渡双轨，消费点一律走 rigOf 直查；实例化合批渲染——每型一份贴图材质）、数值表驱动（js/mob-registry.js 的 MOB_TYPES——-registry 契约，2026-10 自 config 拆出；旗标 ranged/boom/fly/boss 决定行为模式）、血量/受击（闪白·踉跄·击退）/死亡（倒地沉没）/游荡的通用本能。interface：spawn / update / render / hit / near / clear / onDeath（击杀事件：hit 判定存活→死亡的瞬间逐回调恰一次、参数为怪物实体，引擎只报事件不解释死因不做掉落，掷骰归消费方，clear 一并解除注册）（附 list / face / hasSlot / families 谱系分组查询（面板分组唯一入口：按主族归组、无族落独行侠、FAMILIES 未定义时退化单桶；帧序契约在 mobs.js 头注释——update 与模式 AI 相对顺序宽容（dead||gone 双侧自兜底），render 必须最后，壳内不再各自立顺序纪律）/ gait 步态+战斗姿态（第 4 参 attackT 窗口 → 通用挥臂——挥击手=持械手：骨架表 weaponArm 声明持械臂（造型档案声明字段，held 追加骨挂 armL），缺省抡右拳/头前扑，竞技场与探险同一条入口）/ debrisColor 击杀碎块色，以及意图 API——stagger 硬直 / pulseTint 着色 / scaleTo 体型 / move·shift·setPos 水平位移 / steer 面向 / heal·setMaxHp 生命 / remove 立即移除 / settle 贴地回巡航，模式不直写引擎的位移/生命/硬直/着色/体型字段，战斗节拍字段（attackCd/attackT/target）由 spawn 置零、模式读写（曾因模式漏初始化 attackCd 致下界怪物永不攻击，初始化已收归引擎），可写字段白名单见 mobs.js 头注释）。战斗 AI、阵营、晋升、表扬话术在模式层，模式可在 spawn 返回的怪物上挂私有字段；竞技场与坦克演习场都是它的调用方，实例数组归它私有。
_Avoid_: 怪物系统（散称）、mob 数组（那是实现）

**怪物谱系（Mob Taxonomy）**:
怪物种类的双层分类体系：行为原型（proto，战斗 AI 模板位：冲锋/弹道/自爆/伏击/俯冲/炮台/分裂/游击 + 闲逛 grazer=无战斗占位）× 种族（family 标签数组，**种族=长相接近的血统组**，守卫组是唯一职责组例外；不按地域/维度分族；**无兜底族**——每怪必归种族，单员族合法（龙族/海族））。数据在 js/mob-registry.js（-registry 契约，2026-10 自 config 拆出）：MOB_TYPES（family 有序多标签，首位=主族；多族合法——僵尸猪灵/僵尸疣猪兽=猪物种+僵尸血统）+ FAMILIES/PROTOS 注册表；主族折算与家传技能表（FAMILY_SKILLS）/个体特化表（MOB_QUIRKS，tick 钩子型（末影人颤栗瞬移）、laser 声明型（守卫者系蓄力激光）、familySkill:false 豁免型）在 js/arena-core.js（2026-10 随竞技场剥核迁入，见「竞技场核心」词条）；面板分组走怪物库 families()（内联簇式：组头+组员成簇随行流动，未注册键兜底键名不丢桶）。12 个种族：僵尸一家（狂暴）/骷髅一家（强力节奏）/虫虫族（疾爬突进）/猪猪一家（蛮冲）/鬼一族（阴风）/守卫组（磐石）/灾厄帮（袭击协同）/软软族（分裂）/草木族/龙族/海族（后三族家传三期补）/农场一家（passive 牧场动物，见「牧场」词条——不进战斗面板）；个体特化=每怪至多一招；新怪按变体公式"同族骨架⊕环境特化⊕一招专属⊕数值微调"扩展。
_Avoid_: 怪物分类（散称）、怪物种族（单继承树的暗示——谱系是多标签组合）、按地域/维度分族（下界帮已撤——那是产地不是物种）、独行侠（兜底族已撤——每怪必归种族）

**造型档案（MobLook）**:
怪物/人物「一怪一对象」的造型唯一权威（js/mob-look-kit.js 缝 + js/mob-look/&lt;type&gt;.js 一怪一文件声明，文件名=declare 键 ∈ MOB_TYPES∪player——键与文件名零变换，2026-10 立项 docs/mob-look-design.md）：声明 = {base 基座骨 · bones 追加骨（含 axis 翼槽/cube 级 rx·rz 倾斜/inflate overlay）· tex 自绘贴图（五档 32/64/128/256/512）· armStyle 步态 · weaponArm · debris 碎块色 · scale}，几何全部**官方模型像素**（1px=1/16 格，数据源与逐怪规格见 docs/mc-mob-models-research.md——bedrock-samples 核对，D13 版权口径：只取结构比例，像素自绘）。四种基座生成器（人形 humanoid〔headW 宽头参数〕/ 细骨 skeleton / 灾厄 illager〔头 8×10×8+鼻+袍 overlay〕/ 四足 quad〔bodyUV/headUV/legUVs 布局覆写〕——官方「共享基座+逐怪文件」的同构物）+ 自有骨架（苦力怕/蜘蛛式全量 bones）+ scale 变体（基座骨×系数）。kit 负责：px→世界换算（怪物 z 镜像成 +Z / 玩家傀儡 −Z 原生——同一份数据的两个 adapter）· 六面 UV 铺展（区域自外部看，inflate overlay 一等字段）· 程序贴图（纯数据缓冲+种子化随机，画布惰性，texture-atlas 同惯例）· 头像裁切（head 正面→16×16，Mobs.face 自动跟皮肤）· 碎块色。消费方：mobs.js（rigOf 直查——票③已拆内联 MOB_RIG 旧轨与双轨回落）· avatar.js（puppet 傀儡）。全覆盖（MOB_TYPES 全怪除 mix + player），test/mob-look.test.js 断言键集=注册表派生全覆盖（漏迁即红）/布局合法性（不出界+无部分重叠）/贴图全覆盖/确定性。
_Avoid_: 皮肤文件（那是官方素材概念，这里全部程序自绘）、把贴图/UV/镜像换算散写回消费方（语义单份在 kit）、MOB_RIG（已拆——造型档案是唯一骨架权威，消费点一律走 rigOf）

**战斗核心（CombatCore）**:
引擎层纯逻辑模块（js/combat-core.js，零全局依赖，有单测）：leadAim 预测弹道方向（目标移动提前量 + 重力补偿抬枪）、tickCadence 攻击节拍递减（attackCd/attackT，与 Mobs.spawn 置零配套）、hitBody 投射物对身体的盒判定（水平 hitR × 垂直身高段）、stepShot 弹道步进（C6-T1：重力/寿命/欧拉积分/撞块，非变更式返回 {vel,life,x,y,z,hitBlock,dead}，getBlock 注入保零全局——竞技场/下界/探险三份手写步进并一于此；hitBlock 单列保竞技场巨石口径：撞块触发 AoE、寿命尽只移除）。竞技场箭矢/巨石与探险骷髅箭都是它的调用方（历史调用方下界火球已随模式退役）。弹道观感与伤害政策留在模式层。
_Avoid_: 弹道系统（散称）、AI 核心（它不懂战术与阵营）、把弹道步进写回模式层（三份曾各自手写）

**应用层（Application）**:
玩法与政策所在之处：游戏模式、每日预算、存档、语音、菜单。应用可依赖引擎，引擎不得依赖应用。
_Avoid_: 上层、业务层、游戏逻辑层

**模式注册表（ModeRegistry）**:
游玩模式清单的唯一权威（js/mode-registry.js，纯数据+纯函数）：一行派生模式卡/菜单页/返回/出发按钮的 DOM id、脚本路径、儿童时限成员、限额文案里的模式名。main.js 只消费不另持影子——唯一存留是 MODES 手写映射：它是注册表的**仅存合法影子**（模式对象是经典 script 顶层 const，纯数据 registry 反射不到；2026-10 模式切换收口已上双道断言——boot 探针动态键集等价/每键 init 可调 + registry 测试静态源断言，漏行在 CI 当场红，而不是等孩子点新卡炸 undefined.init()）；命名约定（id ↔ cardXxx ↔ menuXxx）由 test/mode-registry.test.js 对着 index.html 逐条断言。
_Avoid_: MODE_CARDS（历史名——三份影子表达已归一）、模式列表散称

**切换清场（switchMode 兜底）**:
模式切换的共享层单一收口（js/main.js switchMode，位于旧模式 cleanup 之后、新模式 init 之前，与 Fx.clear/clearWorld 同拍）：清 Mobs/Tank/Drops 三本共享实体账 + 复位 Avatar 手持物（PLAYER.heldItem）与 voxel.js 的 flyMode——只收共享引擎层的实体账与跨模式存活状态；模式私有物（自管投射物/面板/计时队列）仍归各模式 cleanup，兜底不是其替代（保守版各模式 cleanup 共性行保留为幂等双保险）。两个守恒契约定时序：① Tank.clear 只清实体不解除模式钩子（钩子会话级常驻，tank-range 加载期一次注册）→ 无条件清安全幂等；② Mobs/Drops 的 clear 解除会话回调、由新模式 init 重挂 → 兜底必须在新 init 之前，放之后会抹掉刚挂的回调。拍板记录见 docs/mode-switch-unification-design.md（候选 4，2026-10）。
_Avoid_: 把兜底当模式 cleanup 的替代（私有物不清）、在兜底里解除 Tank 钩子（不存在该 API，契约禁）

### 政策与进度

**共享背包（Shared Backpack）**:
全游戏唯一的 27 槽背包本体（存档键 `inventory_save` 的数据面，政策出 ADR 0002）：探险模式（消耗侧：合成/烧炼/耐久）与专注训练营（产出侧：只产不耗，不接配方/耐久/挖掘/放置）两个消费方跨模式共享同一份物品。存取一律经背包壳（js/backpack.js，唯一持有存档键，不得自开键）；训练营侧口径 = 进模式 init() 时 load 一次（双消费方共用介质，重进必重读）、授予即 save；**里程碑工具不进包**（F3 混装核定选型 B：双模式可堆叠种类并集 35 + 6 件不并堆工具 > 27 槽，工具记账进训练营存档 tools 字段，附带免疫"白送铁镐"贬值探险任务链）。
_Avoid_: focusBag（那是训练营模式层的共享背包实例变量名，非模块名）、模式私有背包键（如 focus_inventory_save——两套账本回潮，违反 ADR 0002）

**每日预算（DailyBudget）**:
一天内可花费的额度，含时长（毫秒）与关数两个维度；儿童时限与专注每日限额都是它的一种配置。
_Avoid_: 时限、限额、限制（混称两种机制时）

**儿童时限**:
面向孩子的防沉迷政策：竞技场、建造模式、坦克演习场、探险模式（下界已是探险的内部相位，不单列）共享的同一份每日预算。
_Avoid_: 游玩限制、防沉迷开关

**游玩模式（Play modes）**:
消耗同一份儿童时限的四个模式：竞技场、建造模式、坦克演习场、探险模式（TNT 密室已随 c69177c 下线、下界冒险已并入探险为其内部下界相位——2026-10，决策见 docs/nether-merge-design.md，均不再单列）。专注训练营不属于游玩模式。

### 游戏模式

**竞技场（Arena）**:
双阵营怪物对战玩法。怪物由怪物库（Mobs）提供，本层只保留战斗 AI、阵营对抗与晋升；技能按怪物谱系发放——家传技能走 FAMILY_SKILLS 族模板（主族折算），个体特化每怪至多一招。政策与数值段（常数表/配平/晋升/索敌权重/家传技能 tick/技能表）在 js/arena-core.js（见「竞技场核心」词条，2026-10 剥核），壳只留观感/编排/装配。

**建造模式**:
自由建造玩法，改动按场景云同步保存。

**坦克演习场（TankRangeMode）**:
载具的第一个投放场：96×96 多地形（丘陵 · 峡谷 · 乱石阵 · 爬坡瞭望台）+ 五类可破坏靶（靶排 · 环靶 · 靶墙 · 靶屋红心 · 远距靶塔）。主菜单坦克卡先进**出发配置页**（坦克一行按 order 排序 + 怪物一行——种类来自怪物库 Mobs.spawnable()，与游戏内 👾 面板共用 mobCfg），点"出发"才重建演习场（选择没变则直回战场保进度），Esc 随时回来换；怪物走怪物库（竞技场同款全怪物，有血量可受击），一次性部署（无波次），清场按 R 再来；开炮炸靶/炸地形，场景每次进入重建（退出即还原，坦克位置不存档）。

**专注训练营**:
基于五维实证范式的百关注意力训练；拥有独立的每日预算（时长 + 关数）。2.0 增量（难度坡道/战利品回路/脑锻炼结构层）的数值唯一权威在 js/focus-levels.js（纯函数+数据表，有单测），屏幕流与观感装配在 js/modes/focus.js——子系统词条见下方：矿袋 · 宝物柜 · 图章日历 · 集章里程碑 · 每日体检 · 魔鬼特训 · 训练师村长；跨模式训练营壳共用件（战利品回路/图章仪式/家长门与面板件/结算星显与续程/壳骨架生命周期）在 js/camp-kit.js（见「训练营壳 kit」）。

**矿袋（Loot Bag）**:
训练营的战利品回路 HUD（观感件自 C1-T1 起住 CampKit.mkLootHud 的 focusLootHud 实例，css/focus.css 观感）：正式试次答对按段位奖励表掷骰（FOCUS_REWARD_STAGES 四段递增，奖励调优 2026-10：品质镜像探险深度带——段1 煤带→段4 钻带，钻石仅段4 出现、金段3 首见、铁锭全程不发（烧炼教学归探险）；变率 p 0.06→0.15 随 tier 递增并乘试次归一（corsi 6 序列与 cpt 20+ 试次每关期望产次趋同）；连对保底已退役（预期的实物工资形态，动机研究 d=−0.36），防空关挫败改关内干燥兜底（连续 10 个答对未掉必得，dry 计数模式层维护、关开始/答错/掉落即清零）；教学关豁免；通关/三星按段位表展开（三星追加段4 才有钻石）），战利品沿贝塞尔弧线飞入矿袋槽位（复刻掉落物真空吸附观感）+ 落袋音，结算页列队回顾；掉落最终进共享背包。满包静默忽略 + 每关至多一次「背包满啦」toast。掷骰/结算/授予政策是种子可注入的纯函数（rollFocusLoot · levelBonusLoot · grantFocusLoot，focus-levels.js，有单测）——掷骰政策在 focus-levels，机制基座（pickWeighted/grantLoot）在训练营机制核心；DOM 动画不直测。集章奖励的矿袋皮肤挂 body.f-bag-iron 类钩子。数值依据与后续模式复用契约见 docs/focus-reward-tuning-design.md。
_Avoid_: f-bag（那是 HUD 的 CSS 类名）、把矿袋当第二背包（它只是共享背包的会话级观感，无独立存档）

**宝物柜（FocusCabinet）**:
训练营今日页的收集展示屏（showFocusCabinet，modes/focus.js）：分组网格（材料/矿物/食物/工具/方块，FOCUS_CABINET_GROUPS 数据表）+ 数量角标 + 点击 TTS 读物品名（iconOf 像素图标），村长导览台词。数据源双轨：材料/矿物/食物/方块组从共享背包计数渲染；工具组从训练营存档 tools 字段按里程碑表序渲染（选型 B 口径：**只认训练营授予的里程碑工具，探险合成所得工具不进柜**——F10 收口维持，柜是训练营成就展示而非全背包镜像）。
_Avoid_: 收集柜/宝物箱（散称）、把工具组改从共享背包渲染（双记账来源，违反选型 B）

**图章日历（Stamps Calendar）**:
训练营的习惯打卡记录（F7，设计稿 §8 B1）：当日完成 ≥1 关得像素图章、满 3 关得大图章，漏签无任何负面标记；今日页本月日历条渲染。存档形状 `stamps={日期: 当日关数}`（1~6 钳制、同日取 max——鬼章同落不双计），滚动保留 90 天（FOCUS_STAMP_KEEP_DAYS）。落账/裁剪/计数机制在训练营机制核心（CampCore.mkStampBook），stampRecord · stampTrim · stampCount 是 focus-levels.js 的薄委托（有单测）。
_Avoid_: stamps 字段名当模块名（那是训练营存档字段，机制在训练营机制核心）、断签/补签（没有这个概念——漏签零惩罚）

**集章里程碑（Stamp Milestones）**:
习惯阶梯的奖励线（F7，与里程碑工具的进度阶梯双轨独立计数、互不折算）：3/7/14/30 章四条达成线（FOCUS_STAMP_REWARDS），奖励只发观感/收集类（自选图章图案 · 矿袋皮肤 · 宝物柜烟花 · 金图章），30 章起每 30 章递进金图章；领取记账 `stampClaimed=[达成线]`，到期判定 stampRewardsDue。红线：永不解锁关卡/范式/难度。
_Avoid_: 里程碑（单称歧义——工具里程碑按解锁关数走 FOCUS_MILESTONES，集章按打卡天数，两条线）

**每日体检（Daily Check）**:
每天一次约 90 秒的状态仪式（F8，设计稿 §8 B3）：复用大师关五维连跑机制（FOCUS_CHECK_PARAMS 各维 tier2 短参数 · focusDispatch sections 分发），计入时长不占关数额度，当日做完入口消失；产出三档探险家火苗（focusFlame：≥85 大 / ≥70 中 / 其余小），只与自己近 7 天体检均值比（checkBaseline，窗口不含今天）、只显示变亮不显示回落，小火苗配中性温暖文案。存档形状 `checks={日期:{acc,flame}}`，滚动 90 天（FOCUS_LOG_KEEP_DAYS）。
_Avoid_: checks 字段名当物理名、专注年龄/智商分/百分位排名（标签化单一指标，合同 Out of Scope）

**魔鬼特训（Devil Training）**:
每日一次的高强度挑战（F8，设计稿 §8 B8，参照《5 分钟鬼训练》外壳；**n-back 永不引入**，MISSION <8 岁排除条款）：5 分钟硬顶（FOCUS_DEVIL_TIME_MS，到点当前小节打完即强制结束、当日锁定入口），计 2 关额度 + 计入时长；维度按日轮换（devilDimFor，天数 %5），挑战档 = 该维度当前档 +2 封顶 19（devilTierFor · devilParams）；每维度独立鬼等级 1~10 按 85/66 双阈进退（devilStep：≥85 升 / 66~84 保持 / ≤65 降），失败零扣损、降级文案中性（鬼村长坏笑「下次再来！」）；通关得鬼图章。存档形状 `devil={levels:{维度:鬼等级}, days:{日期:训况}}`，滚动 90 天。
_Avoid_: devil 字段名当物理名、鬼计算/n-back（招牌内核即 N-back，被排除）、扣损/重置（零惩罚哲学）

**训练师村长（Chief）**:
训练营的像素主持人格（js/focus-icons.js 的 chiefFace，16×16 字符画→96px 既有管线）：微笑/喝彩/打盹三表情 + 魔鬼特训鬼化变体（矿工帽加鬼角 + 坏笑，mood='devil'），主持开场/规则/喝彩/授予仪式/宝物柜导览；文案与语音走既有应用层话术与 SpeechKit 通道（夸努力不夸聪明）。同库相伴：stampIcon（六图章）与 flameIcon（火苗三态，CSS 摇曳底图）。
_Avoid_: NPC/向导（散称）、把表情画散写在模式层（像素画归 focus-icons 管线）

**数学冒险岛（MathMode）**:
第一学段（1~2 年级）数学思维训练营模式（js/modes/math.js，训练营类同专注训练营：全屏接管 UI、独立每日预算 6 关/20 分钟、不计儿童时限、无菜单页）；120 关关卡地图（G4 扩容，四带 × 30）= 六族 × 四学期带螺旋混编，难度双轨（数值跟带不超前、思维跳到附加题级）；关卡流程（今日页→地图→屏流/世界轨关卡→结算）与家长面板（六族×四带矩阵/思维挑战通过率/近 7 日趋势迷你图/CSV 导出/诚实口径说明）在此装配；跨模式训练营壳共用件（战利品回路/图章仪式/家长门与面板件/结算星显与续程/壳骨架生命周期）在 js/camp-kit.js（见「训练营壳 kit」）。_Avoid_: 数学模式（散称）、数学游戏

**数学关卡参数表（MathLevels）**:
`js/math-levels.js`，数学关卡数值唯一权威：六族元数据与情境变体登记（MATH_CONTEXTS）、四带数值轴、双轨难度曲线（**mathParamsFor**——不叫 paramsFor，focus-levels 已占用该全局名；变体级曲线覆写 = 变体表 **tune(p, tier)** 字段，G4 起 dualview/bridge 的推理档/候选/视图/预算在变体内重爬）、120 关编排（**MATH_LEVEL_MIX** 每带目标次数表 + 均匀交错）、通过门槛/三星（挑战挂钩 + **mathLevelStars** 三星回溯：素质线达标记 ready，补过挑战后地图重算点亮，stars 表只作历史最高）、战利品表与掷骰、图章一本（机制同源训练营机制核心 CampCore，家族名薄委托）、家长面板聚合（mathPanelMatrix/mathPanelCsv/mathPanelTrend）、存档默认值/迁移（**版本位 v**：关号语义变化时一次性清空关号三表）。_Avoid_: MATH_LEVELS 影子表、paramsFor 直呼（那是专注训练营的名字）

**谜题纯核心（PuzzleCore）**:
`js/math-puzzles-core.js`，出题与判分的纯数据变换（种子注入，同 seed 同输出）：图案镜像/平移/旋转与对称补全、俯视图纸投影、正视/侧视投影与双视角推理（US24：任一单视图与干扰共享、综合两视图才唯一锁定）、隐藏块/露面计数、数列与周期、合成多解枚举、天平代换链、线索排队、间隔问答；呈现红线常数 LIMITS（组块≤4/线索≤3）。_Avoid_: 题库（不是题库，是生成器）

**数学屏流引擎**:
`js/math-paradigms.js`，屏流族（数一数/算一算/找一找/站位比大小/情境三馆）的呈现-点选-反馈流程与小部件（DOM 惰性、零渲染引擎、假 doc 可测）；世界轨驱动器的**第三交互插件**（T5 迁入，2026-10——16 屏流变体在统一注册表 MATH_TRACK_RUNNERS 注册，键集加载期自本文件 MATH_SCREEN_ENGINES 引擎表派生；清完再发 end 的 DOM 项由 stop 清 area 担保）；mathScreenDispatch 仍是引擎内部的"变体→引擎"纯函数表（测试锁）——清单存在性权威在驱动器注册表，两表互锁由测试担保。_Avoid_: 数学范式（范式是专注训练营的词）

**数学情境变体（MATH_CONTEXTS）**:
挂在六族上的情境皮肤变体（登记表在 js/math-levels.js）：人民币商店（craft/shop）、钟表时刻（hop/clock）、测距步数（count/measure）——不独立成族，编排生成器在每情境族每带首个轮转位只换 variant（共 12 关），tier/kind/params 与承载族曲线同源，数值跟带。_Avoid_: 情境族（不是族）、独立模式

**数学图章**:
数学冒险岛独立的集章一本（家族名 mathStampRecord/Trim/Count/Milestones/RewardsDue 在 js/math-levels.js）：日历式记录（钳日限 1~6）、滚动 90 天、自选章图案（宝石/星星/加号）、集章达成线领奖纯观感永不解锁玩法；与专注训练营图章互不相通——账本独立、机制同源：纯函数机制在训练营机制核心（CampCore.mkStampBook），math-levels 家族名为薄委托。_Avoid_: 与专注图章混称

**跳一跳世界轨纯核心（HopWorld）**:
`js/hop-world-core.js`，hop 族世界变体（掷骰前进/跳格子任务/间隔问题+规律跳）的出题与判分纯函数：线性数路布局（蛇行只是视觉折行、数序沿路不变——Ramani & Siegler 线性数板口径，环形无效）、骰步、跳格试次、间隔/规律题的格空间包装（PuzzleCore 神谕 + 平移/换算）、恰 4 项数字选项条。_Avoid_: 把路径布局写进模式层（判分纯逻辑归此核心）

**数学世界轨（MathWorldTrack）**:
`js/math-world.js`，世界轨驱动器（js/math-track.js）的 **hop 交互插件**（混合宿主）：混合宿主（透明 mathRoot + 点选接球层 + 任务卡覆层，全程不锁指针、纯鼠标点选）、场景装填（≤32×32 草岛数字路，进场装场退出清场）、Avatar 走子逐格读数、相机跟随、试次循环与逐试次 onTrial 交回驱动器（记分/节拍在 MathTrackCore，生命周期与清完再发 end 由驱动器担保）。_Avoid_: 世界轨渲染/交互写单测（判分已下沉纯核心，装配由 boot 冒烟兜底）

**摆与搭世界引擎（BuildWorld）**:
`js/math-build-world.js`（THREE/DOM 装配，指针锁宿主）+ `js/math-build-world-core.js`（纯核心·有单测：谜题形状派生/候选与数字点阵/图纸像素投影/最省桥 US20——bridgePlan 两岸地形+可证最少块数 par（逐列步行高度最短路 DP）、bridgeGrade 三判据判分（步行连通/建造区/不悬空，≤par 判"最省"、>par 给"能过但不最省"）、bridgeOk 推理档判分口径（G4：reverse 档能过即对/multi-solve 档要最省）、mkBridgePuzzle 出题包装（跨度跟 blocks 预算）、mkWorldDualView 双视角装配裁剪（G4：候选 2/4 与视图 1/2 按变体曲线注入，single 档单正视图即唯一解））——摆一摆（mirror）/搭一搭（plan）两族世界变体的呈现-点选-反馈引擎：每试次经场景装填（loadScene）装一个 ≤32×32 小场景（石英画布+玻璃标记+世界内候选牌/立式投影牌），放置类走瞄准射线点选放置/撤除（建造模式形态的关卡内临时放置，最省桥经 canPlace 缝限定河面桥线）+发光石「好啦」交卷（摆对即时自动过关，判分经 gradeCells 缝可定制），选答类点世界内图纸牌/七段数字牌/候选建筑（指针锁定下 DOM 按钮点不到，答案牌长在世界里）；判分全部委托谜题纯核心（gradeSymmetry/gradeBlueprint/hiddenBlocks/exposedFaces），最省桥例外（地形语义判分收在 BuildWorldCore.bridgeGrade）。进场装场·退出清场·不写建造存档。与 hop 的混合宿主（js/math-world.js，不锁指针）并列，同为世界轨驱动器（js/math-track.js）的交互插件，分发/生命周期/boss 串链由驱动器统一持有（原「宿主统一留待后续票」已随 T4 交付；T5 屏流迁入，三插件终态达成）。_Avoid_: 把摆与搭判分写进装配层（纯逻辑归 math-build-world-core）、math-world.js（那是 hop 世界轨的文件）

**世界轨驱动器（WorldTrackDriver）**:
数学冒险岛关卡节的唯一运行 seam（`js/math-track.js` 应用层装配 + `js/math-track-core.js` 纯核心，均有单测）：变体分发（dispatch(family,variant)→'screen'|'world'|null 纯查表，未册键返 null——T5-b 废除「未知键归世界轨」）、单节生命周期（run：屏流/世界同一入口，**清完再发 end**——离场含 clearWorld/HUD/指针收口先于消费方结算，时序由 seam 担保不靠各引擎自觉）、boss 小节串链（runBoss：400ms 接力 + alive 旗整链中止，原 mathCtrl/mathBossStop 两条命合一）、退出收口（leave=单节离场 / stop=整链一刀，幂等）。三交互插件经统一注册表 **MATH_TRACK_RUNNERS**（{kind:'screen'|'world', run} 形状，29 键=16 屏流+13 世界；屏流键集加载期自 MATH_SCREEN_ENGINES 引擎表派生，两表互锁由测试担保）收在驱动器：js/math-world.js（hop 混合宿主）、js/math-build-world.js（摆与搭指针锁宿主）、js/math-paradigms.js（屏流引擎，T5 迁入——三插件终态达成）；试次循环骨架（记分账本/连对连错节拍/试次钳制/boss 规划/聚合）在 MathTrackCore 纯核心。interface：`MathTrack{dispatch · run · runBoss · leave · stop · active · mouse · runners}`。
_Avoid_: mathCtrl/mathBossStop（历史名——控制柄与链旗两条命已合一）、mathWorldLeave/mathStopRun（历史名——退出收口已收进驱动器）、MATH_WORLD_RUNNERS（历史名——统一注册表已改名 MATH_TRACK_RUNNERS，屏流 T5 并入后 29 键）、把「清完再发 end」时序下放回引擎或模式层（纪律归 seam）、在世界插件里自持清场以外的退出收口（HUD/触屏键/指针归 stop 统一收）


**下界冒险（NetherMode）**:
已退役模式（2026-10-26 拍板：下界并入探险模式成为其内部相位，js/modes/nether.js 与 test/nether-mode.test.js 已删；决策清单 D1-D17 与施工契约见 docs/nether-merge-design.md）。现在想去下界 = 在探险模式合成全表最贵物品「下界传送门」放置踏入（见「下界传送门」词条），地形/门框/判定纯函数已剥核进探险核心下界段（见「探险核心」词条）。以下为退役前形态的决策考古记录：上界（Overworld）↔ 下界（Nether）穿越的冒险玩法。上界由建造模式精选场景「巨大地下室」作本模式地形（地形暂时复用建造模式场景；「巨大地下室」场景随模式退役），地表入口处有下界传送门（见「下界传送门」条目）；踩进传送门 → phase 切换到下界：平整下界岩地面 + 成片熔岩池 + 回程传送门（落地就从门前走出，门在身后）。下界怪物（猪灵系 / 凋灵骷髅 / 烈焰人 / 恶魂 / 岩浆怪…，MOB_TYPES 下界数值）全部 hostile，主动攻击主人公（走路有步态、攻击有挥臂——挥击手=持械手/头前扑姿态——怪物库 gait 的战斗姿态窗口）；主人公进下界自动武装——武器栏（mkHotbar，数字键/滚轮/点选）在 ⚔️剑（近战挥击，即时判定）与 🏹弓（远程射箭，沿准星方向的竞技场同款重力弹道）间切换，手持物随注册表 def 变观感（回上界/退出模式换回锄头）；伤害/触及/箭速/冷却都是模式政策常量（手持物 def 只管观感，不漏玩法知识）；被打中的受击提醒 = 身体闪红（Avatar.flash）+ 头顶常驻血条（canvas 贴图 Sprite，血量变化才重绘）+ hurt 音色 · 震屏 · 3 秒节流语音（剩血 toast 已退役，血条接管）；阵亡 = 被送回家（切回上界满血落地家门口、清掉下界怪物与残留投射物，想再战再走进传送门，波次从头开——零挫败设计，也不在原地重生被围殴）；打完一波 → 新一波。波次/AI/火球管线/独立武器栏已随退役裁撤（D2），未迁入探险。

**下界传送门（Nether Portal）**:
探险模式全表最贵的合成物（8 金锭环形 + 中心 1 钻石，station 'table'，追加在 RECIPES 最末——配方书压轴，D3）与放置型物品（ITEMS 键 nether_portal，无 block 字段——放下长出整座门的结构放置由探险壳拦截，不走单格放置路径，D4；可重复合成、放多座，下界内也允许放——任何下界的门都通往「最后进入的上界门」旁，D6）。门体：黑曜石主框 6 宽 × 7 高（比 Minecraft 最小门 4×5 放大一圈），内口 4 宽 × 5 高填紫色半透明门面方块（B_PORTAL：`glass:true` 走透明渲染通道——勿用 thin，LOD 降采样会跳过；`solid:false` 可直接穿入；`portal:true` 旗标为身份）；霸气外观件（两侧黑曜石塔楼 + 发光岩压顶、阶梯门楣 + 顶心发光岩、开口四角发光岩、前后下界砖步道）全部对称且都在内口判定区之外；门框/门面声明式不可破坏（无 `hard`，含 TNT 免疫判据）+ 挖它给儿童话术，D5。门中常驻紫色光束动效（Fx.portalBeam：脉动双层光柱 + 环绕上升微粒，句柄制——removeBeam 摘除、clear 连带清场、模式层只报开口锚点）。踩入内口即传送（上界↔下界双向，冷却 ADV_PORTAL.cd 落地空眩晕）；传送判定（探险核心 advInPortal，脚格/头格任一为 B_PORTAL 的 O(1) 判定）只认内口方块身份，与外观件完全解耦——改外观不破坏判定。建场/门框/判定/校验/落点纯函数在探险核心下界段（advNetherBuild/advPortalFrame/advInPortal/advPortalSiteOk/advPortalExit），切界装配在探险壳；设计权威 docs/nether-merge-design.md。

**探险模式**:
物品与合成系统的第一个消费者（壳 js/modes/adventure.js + 纯核心 js/adventure-core.js，见「探险核心」词条；壳的测试面 `AdventureMode.adv` 已收敛为 20 键（下界相位与生态地图切图后续追加，键清单即 interface——以壳层键清单注释为准）——2026-10 评审候选 5：状态账本/存档只读快照 getSaveView/布置缝/交互链入口/查询 seam，core 纯函数不再经挂点转发〔测试走 core 直调〕，熔炉走 FurnaceKit 站点实例直达〔map/state/at/open/close…，名号薄委托已撤〕，无测试使用的存量键删除，行为面等价的入口〔onVoidFall/onKey('KeyH')/引信起爆链等〕不再单设键）：128×128 确定性草原（重进逐块复现，只存玩家差异）——树林 · 湖（湖底黏土，红砖链源头）· 2 露天矿坑（坑壁裸露煤/铁矿）· 山洞隧道通 y<10 钻石带 · 出生小屋 · 3 怪物巢穴（每巢限量 2~3 只、清空 60s 再刷、索敌收敛不追出巢区——儿童可控口径）。挖掘按住蓄力（breakTime 驱动，tier 不足只碎不掉+TTS 节流提示）→ 掉落真空拾取；放置型物品点准星面放置、树苗 20s 长成树（计时 Map 不落盘，重进重建）；食物点击吃、工具耐久归零消失+TTS 安抚并句当前任务步指路、低耐久比 <0.25 语音预警（每工具每命一次，破板重置）；工作台/熔炉走近 4 格解锁（MC 式放置解锁）——工作台 3×3 摆放台按配方图案摆材料合成（随身 2×2 摆放格随时可摆；配方卡=BE 口径一键摆入、产出槽点击一发/长按连做，TTS 具体表扬+余量转脚下掉落物，九宫格改造见 crafting-grid 设计稿）+ 熔炉 2.5s/件自动烧炼·**每炉独立+炉态随世界档持久化**（重进接着烧、挖炉/TNT 掀炉三笔退包、炉口火焰观感+面板燃料余量条；旧「退世界/死亡全额退料」政策已退役——二期 F1/F2）；TNT 合成→放置→空手点燃→延时爆炸（半径 3.5、方块 70% 掉落、不伤玩家——儿童挖矿神器）；金苹果=金锭出口（8 金锭+1 苹果，吃了回满血，首获仪式挂合成侧——F3）；牧场（见专条）——草原散布牛猪鸡羊，击杀「收获」生肉/羊毛，熔炉烤成熟肉回血更多（F4）。任务链 QUESTS 数据表 15 步+终章（引导链 v2，插步依据见 docs/story-quest-research.md：安家章 原木→木板→工作台→箱子→树苗 / 挖矿章 木镐→圆石→石镐→煤→火把 / 冶炼章 铁矿→熔炉铁锭→铁镐 / 冒险章 战斗→钻石→钻石剑；5 原木=20 板恰好覆盖早期链）：事件挂点（挖掘/拾取/合成/放置/开箱/烧成/击杀）只向计数账本累计（只增不减=跳步防护，只认玩家亲手做——TNT 掀掉的不算，TNT 炸死怪物算战果），0.5s 节流查当前步谓词不越级；钻石首获专属仪式，终章合成钻石剑得「小小探险家」称号+烟花。死亡=背包保留+回出生点满血+TTS 安抚（零惩罚）。背包占用 ≥24/27 一次性 toast+TTS（回落再满才再提醒；放过箱子后话术指向收纳）。大宝箱见专条。**下界相位**（2026-10 下界冒险并入，设计权威 docs/nether-merge-design.md）：合成「下界传送门」（全表最贵，见专条）放置踏入——平地下界岩+成片熔岩池的远征地图、无怪无昼夜（恒夜暗红天，dayTime 暂停）、唯一危险=岩浆、改动记账落盘（世界档 netherEdits 分桶重放）、死亡顺带切回上界；门/判定/落点纯政策在探险核心下界段。多地图远征（沙漠/雪原/沼泽三张生态图 + home 门阵传送，2026-10 生态地图）见「冒险地图」「传送门阵」词条。四份存档：inventory_save（全局唯一背包，跨模式共享，经背包壳 Backpack 唯一持有——ADR 0002）/ adventure_world_save（确定性重建+edits 重放）/ adventure_quest_save（任务进度）/ adventure_chest_save（大宝箱账户）。与其它游玩模式共享儿童时限，不新增账本。
_Avoid_: 生存模式（没有饥饿，死亡零惩罚——非生存口径；**有昼夜**：夜怪/床/灯笼/火把光照见 docs/mc-daylight-torch-design.md）

**传送门阵**:
探险模式的跨图传送子系统（壳装配 js/modes/adventure.js，站桩/落点/解锁政策纯函数在冒险地图核心，门体几何复用探险核心 ADV_PORTAL/advPortalFrame，设计稿 §2.3/§4）：home 屋东门阵广场三门位（desert/snow/swamp 各一扇——门位唯一权威=ADV_MAPS home 行 gates）+ 各远征图一扇回程门常驻（to=home 恒亮）。**门→图绑定=门阵包围盒查表**（advGateAt：脚格命中当前行某扇门的门面平面）——命中=地图门，未命中=玩家自放的 nether 门（保持「即时+冷却」语义，不套站桩）。地图门时序：门面内 2s 站桩可反悔（走出门面即刻归零，纯步进 advGateHoldStep）→ 400ms 紫白渐晕淡入（#portalVeil 径向渐变忌纯黑，幼儿口径）→ 满格瞬间 advSetMap 同步切图（实测 12-25ms 一二帧）+ 双段音效（起步蓄能/portal_travel）+ TTS 到达播报 → 400ms 淡出，全程 2.8s（红线 ≤5s）。解锁=任务档 counts 键（ADV_UNLOCK_KEYS）+ 点亮仪式 advUnlockRite（gate_unlock 琶音+紫色冲击波+运行时熄→亮以 B_PORTAL 原位覆写微光门面+光束，补格同拍 markDirty 重网格）；熄门立框+**暗紫微光门面**（B_PORTAL_DIM=63，2026-10-27 拍板——读得出「是门只是没开」，id 异于 B_PORTAL 故 advInPortal 天然不命中=不可触发），走近按任务进度播**分级话术**（前置任务未成当前步=泛指「先做完任务卡的任务」不剧透未来步；已是当前步=点名该任务 goal）。冷却复用 ADV_PORTAL.cd（落地空眩晕，两类门同款）。
_Avoid_: 把站桩/渐晕遮罩叫加载屏（它是到达仪式——切图本体同步成本仅 12-25ms，遮罩是观感设计不是性能遮羞布）、把门位写死在壳层（行数据权威在 ADV_MAPS）、给 nether 门套站桩（即时口径已拍板不变）

**大宝箱（Chest Vault）**:
探险模式的储物子系统（引导链 v2 拍板：只储物不解锁配方、全局共享账户、材料扩容）：箱子=8 木板·工作台级合成（MC 正典），放置后走近 4 格点击打开（熔炉同款门槛）mode-kit 的 mkChestPanel 面板——箱子格/背包格两栏**点选搬运**（无拖拽，拍板②），可堆叠并堆、工具连耐久整槽搬（不走 InventoryCore.add——add 经 mkStack 会把工具重铸满耐久）；满箱/满包只拒收不惩罚。**全局唯一账户**：所有放置的箱子打开同一份存储（存档键 adventure_chest_save，{size, slots}），挖掉箱子内容保留在账户里（零损失）；三档扩容 9→18 格（8 圆石）→27 格（4 铁锭），材料刻意取任务链产物（第 7/12 步自然到期），阶梯与入箱政策纯函数 advChestNext/advChestPut 在探险核心。联动：背包快满提醒在放置过箱子后话术升级为「把宝贝放进箱子里吧」（提醒复用已教过的机制）。
_Avoid_: 箱子系统（散称）、把箱子做成合成站点（拍板：合成仍要工作台）、每箱独立存储/内容散落（全局账户是拍板——儿童零丢失口径，绕开每箱挂载记账）

**牧场（Livestock）**:
探险模式的被动动物子系统（二期设计稿 §4，拍板④）：草原确定性散布 2 群 10 只（牛×2+羊×2 / 猪×3+鸡×3）——清单纯函数 advLivestockSpots/advLivestockPlan 在探险核心（**零世界读**：树位复用 advTreeSpots 纯清单，同 seed 同清单、玩家改动不漂移）；存活记账=世界档 livestock 死畜索引账（击杀并进既有 onDeath 掉落回调落账，只存已杀——初始清单可推导，**不重生** MC 口径；游荡位置不存档，重进回散布原位）。引擎侧：MOB_TYPES 农场四怪（牛 15/猪 15/羊 12/鸡 6=MC×1.5）带 **passive 旗标** + grazer 原型（无战斗占位）+ farm_line「农场一家」种族；**spawnable() 收窄为「可战斗部署」**（排除 mix 伪类型与 passive——竞技场 MIX_POOL/坦克演习场 RANGE_MOB_KEYS 零改动自然排除）。行为全在模式层 advHerdTick（不进 advMobAI）：受击逃窜（实体私有字段 __fleeT 3 秒 ×2.2 背向玩家；入口两路=挥击经 combat-kit mkMelee 的 onHit seam/TNT 波及）> 玩家贴近 ≤2.5 格让开（×0.8）> 闲逛吃草（__ambleT/__ambleDir 自持计时，六成时间缓步）；决策纯函数 advHerdStep。击杀走**「收获」口径**（killBurst verb=收获，kill_mob 任务记账排除——动物是收获不是战斗），掉落生肉/皮革/羽毛/羊毛接**熟食链**（SMELTS 烤肉 4 条，熟肉回血镜像 MC 饥饿值：生 3→熟 8）。
_Avoid_: 把动物当怪物（不反击/不进战斗部署面板/不算击杀任务）、动物重生（MC 也不刷——牧场会空是「保护动物」的隐性教育）、给牧场开第二份存档键（死畜账在世界档里，与 furnaces 同一份）

**体验馆**:
仅开发人员可见的调试模式（js/modes/showroom.js + js/showroom-core.js 供给核心；注册表 dev:true 字段——卡在 index.html 在场但默认隐藏，URL ?dev=1 解锁显示）：**冒险全开实验室（2026-10-27 v2 升格，docs/showroom-design.md §7）**——一个「所有条件都满足、退出再进恢复原装」的冒险存档替身：合成/烧炼/物资三链全开 + 预建大房子与地下室（插满火把、展台陈列、站点齐备），开发者亲手玩冒险的一切细节找 bug（不是自动化测试管线）。供给三件全**派生自权威注册表、零手抄清单**（js/showroom-core.js，派生不变量有单测：套餐出发每条 RECIPES 配方 canCraft 全绿、仓库箱五桶=ITEMS 全集划分）——背包套餐=RECIPES 全配方 shapeCost 材料并集（揣着就能合成任何配方）；仓库箱=ITEMS 字段驱动五桶（工具·耗损/食物/烧炼·燃料/方块·功能/材料杂物，新物品按注册字段自动归箱）；展台展品=可放置方块物品−站点件。冒险加新物品/新配方，体验馆零改动自动同步。面板全走既有 kit 的第二消费者缝（不造第二份实现）：合成=ModeKit.mkCraftPanel（station 恒真=台级配方随处摆、allow 放开全部隐藏配方）；箱子=ModeKit.mkChestPanel + adventure-core 的 advChestPut/advChestTake 纯函数（每箱一个内存账户）；熔炉=FurnaceKit（多炉 posKey 寻址，探险的炉与这里的炉是同一缝上的两个 adapter）。红线：不计儿童时限（gated:false）、不读不写任何孩子存档键（含共享背包 inventory_save 与大宝箱账户——ADR 0002，体验馆背包与箱账户都是自建内存实例，进场重铸恢复原装）；挖/放与冒险壳结构交互（门/床/进食）显式推迟到 place-kit 抽取票（§7 D5）；体验馆是常驻工具，没有"毕业进正式模式"的概念。
_Avoid_: 实验室（旧废弃名——2026-10-25 正名：它是体验场景不是科研场景；2026-10-27 v2 定位升格为「冒险全开实验室」，但模块名仍叫体验馆/showroom，勿改文件名）、把体验馆当玩法模式（不进孩子限额清单、无菜单页）、体验馆自开存档键（数据隔离红线）、手抄物品/材料清单进体验馆（供给必须从 ITEMS/RECIPES 派生——手抄表是同步漂移的根源，v1 的 SHOWROOM_STOCK 已随 v2 废除）、为体验馆造第二份烧炼/合成/箱存取实现（三链全走共享 kit 与政策纯函数）

### 玩法时间预算
- 每日儿童时限（每日预算 DailyBudget）: 所有游玩模式共用同一份 play 预算，不新增账本。
- 家长加时（play_extra_save）: 为单台设备当日叠加的儿童时限额度 `{date, ms}`。服务器权威：家长写 `data/play-extra.json`（`{设备ID:{date,ms}}`），`GET /progress` 读时注入、客户端回写冲不掉；客户端读时求值（纯函数 readExtraMs 在 daily-budget.js，接线在 main.js setupBudgets），次日自动回落默认限额。
