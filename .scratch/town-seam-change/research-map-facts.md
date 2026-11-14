# 调研·撤小镇独立入口改冒险主路过场——事实底座(纯事实,无设计决策)

> 派令:为「撤小镇独立模式入口(MODE_REGISTRY 卡 + js/modes/town.js,ADR-0009 的缝),改冒险地图主路尽头→白闪过场→维度进小镇」的设计回炉供弹药。
> 调研工产出 · 2026-11-13 · worktree town-design(HEAD 99ed7a0)。
> 只出事实与引用(file:line);取舍归需求线/architect/PO。坐标均为 home 图 160×160 整格格坐标(z 小=北),ADV_GROUND=24(地表基准)。

---

## 〇、一句话定位(事实)

PO 所说「目前小镇那条路」在仓库中有唯一对应物:**home 图(家园草原)的东向动线**——从小屋/广场沿圆石小径向东,穿过东带(过渡带 x128~159)的土路主径,尽头是告示牌(x156)+木栅栏线(x157),栅栏外隔离带 x158~159 是「小镇建造中」远景剪影(含钟楼 z74)。该方向**现状无传送语义**(east 无触发线),是 2026-11-06 拍板的「观感收尾」。

---

## 一、主路定位(最关键)

### 1.1 「主路」在哪张图上

- 冒险模式现有 4 张图:home(家园草原)/desert/snow/swamp(`js/adventure-maps-core.js:432-490` ADV_MAPS 注册表;home 行 `js/adventure-maps-core.js:433-449`,建场函数 advBuildWorld)。
- **主路在 home 图上,且只有 home 有**。远征图无小镇方向的路:三张远征图各一扇回程门,全部开在面向 home 的那条图缘(沙漠北缘 (58,3)/雪原南缘 (58,155)/沼泽东缘 (154,70),`js/adventure-maps-core.js:56,74,90`)。
- 探险模式无「home 图/边缘带图族」之分:边缘带(过渡带)是 **home 图内部的东部条带**,不是独立图。

### 1.2 主路走向:起点→终点(沿 z≈74~75 轴线自西向东)

| 段 | 位置 | 地标 | 引用 |
| --- | --- | --- | --- |
| 起点·小屋 | 小屋北门洞向东 | ADV_HUT(小屋,坐标不动保老档出生语义) | `js/adventure-core.js:190`(ADV_HUT_C 圈层锚点);设计稿 §2.4「小屋 (61,81) 不动」`docs/adventure-maps-design.md:102` |
| 门口段 | x62~77, z76~77 | 圆石小径(2 宽走廊内 (x+z) 偶数格间断铺圆石) | `js/adventure-core.js:164` |
| 广场 | **ADV_GATE_PLAZA x78~92, z74~88**(15×15 压平+圆石满铺) | 2026-10-27 用户拍板东移 8 格(屋墙 x64→塔楼 x79);T9 后是纯家园地标(q16 visit_plaza 触发矩形仍消费) | `js/adventure-core.js:148-155`;`js/adventure-core.js:2888-2891`(q16) |
| 东段小径 | **x93~108, z74~75** | 「广场东缘向东指引望塔(矿业圈外侧)」 | `js/adventure-core.js:167` |
| 途经地标·望塔 | ADV_TOWER {x:114, z:66} | 7×7 石砖塔(室内红蓝羊毛内旋梯登顶+顶平台宝箱),矿业圈东侧高点地标 | `js/adventure-core.js:178-179` |
| 东带①入口段 | x128~139(12 格) | 草 70%+土路斑 1 patch——**实现位 x132~135, 主径线 z73~76** | spec `docs/world-edge-design/east-spec.md:54`;实现 `js/adventure-core.js:1450` |
| 东带②渐密段 | x140~151(12 格) | 土斑 2 patch(x140~143 z70~73;x148~151 z76~79)+花田 2 处(主径两侧各 5 朵,黄/白二色;红花无图集格位=T7 登记偏差维持) | spec `docs/world-edge-design/east-spec.md:55`;实现 `js/adventure-core.js:1451-1458` |
| 东带③主径+到达段 | x152~159(8 格) | **主径连续 x152~156, z74~75**(「与既有东向小径同轴延长」)→告示牌→栅栏→隔离带 | spec `docs/world-edge-design/east-spec.md:56`;实现 `js/adventure-core.js:1459` |

### 1.3 尽头的具体位置(可直接引用的事实块)

```
【主路尽头事实块】(home 图, ADV_GROUND=24)
主径轴线: z74~75(与广场 z74~88、钟楼 z74 同轴对齐)
告示牌:   x156, 立式双柱(柱脚 z73/z76, y+1..y+3; 板面 z74~75, y+3..y+4),
          牌面朝图内(西), 文案语义「小镇建造中」(拼块形制无字=T7 登记偏差)
          —— js/adventure-core.js:1462-1471; docs/world-edge-design/east-spec.md:17,79-83
木栅栏线: x157, 南北横贯 z0~159 全长; 原木桩(2 高)每 3 格一根(z%3==0),
          缝格横杆(1 高); 碰撞≈桩2/缝1 整格近似(MC 1.5 格先例);
          桩间留缝=设计本体(「看得见、过不去、但不堵心」); 不可挖保护
          (advEdgeProtectedAt 东向恒保护); 翻越=彩蛋口径(T7 转正)
          —— js/adventure-core.js:1473-1487; docs/world-edge-design/east-spec.md:16,71-77
隔离带:   x158~159(栅栏外 2 格, 不可达——x160 世界硬缘)
小镇剪影: 房屋×4 [z=24 高3 / z=56 高5 / z=88 高4 / z=120 高3](石色, 深蓝灰
          无图集格位=登记偏差) + 钟楼×1 z74(塔身 y+1..y+7 全场最高 7 格,
          尖顶 y+8, 顶灯火把 x159) + 圆冠树×2(z=40/108, 2026-11-12 收编
          带盐 8402) + 灯点 4 粒(窗灯 3 + 塔灯 1, 均火把=夜间发光)
          —— js/adventure-core.js:1489-1519; docs/world-edge-design/east-spec.md:18,87-93
四角收尾: NE 角镇郊融雪楔(x146..156 越北越稀, 盐 8501)/SE 角流沙半埋栅栏
          (桩脚下水=「栅栏桩打在水床」读法, 原木栈桩支起)+镇南郊草甸南侵
          楔(止步 z138, 盐 8506)
          —— js/adventure-core.js:1528-1562; docs/world-edge-design/east-spec.md:170-174
```

- 主径/剪影/钟楼的**轴线对齐是事实**:主径 z74~75、告示牌板面 z74~75、钟楼 z74、走查修订确认「③主径连续(x152~156),即 §3 定稿节奏原样落地」(`docs/world-edge-design/east-spec.md:163`)。
- 栅栏/告示牌/主径/花田/剪影/圆冠树坐标**零重叠**,经四角 post-pass 逐件核对(`js/adventure-core.js:1532-1534`;`docs/world-edge-design/east-spec.md:172`)。

### 1.4 地图数据里已有的「通向小镇」预留(逐条)

1. **东带=「小镇观感」是写进设计权威的定向预留**:world-edge 地图拍板 4(Q4 用户提案)「东向=小镇观感:土路+栅栏+告示牌『小镇建造中』,走到头被栅栏挡住+话术;小镇本体 out of scope」;拍板 5(Q7A)方向分配「北=雪原、南=沙漠、西=沼泽、**东=小镇**」(`docs/world-edge-map.md:23-24`)。
2. **Out of scope 明文**:「小镇本体世界(未来独立努力;本次只做东向观感收尾)」(`docs/world-edge-map.md:56`)——即本次 PO 变更正是把当年出界的「小镇本体」接上,原缝预留的是**观感端**。
3. **方向映射表 east 无键**:`ADV_EDGE_DIR_MAP = {north:'snow', south:'desert', west:'swamp'}`,注释「east 无键=东向无传送语义的自文档表达(T5 定稿收尾, 栅栏彩蛋跳缝不触发)」(`js/adventure-maps-core.js:508-511`)。home 侧三向有虚拟回家锚 ADV_HOME_EDGE_GATES(北 (58,23)/南 (54,128)/西 (31,70)),**east 无锚**(`js/adventure-maps-core.js:609-615`)。
4. **触发线 east 恒 null**:`advEdgeTransitDirAt` 注释「east 恒 null=东向无传送语义(T5 定稿收尾, 栅栏彩蛋跳缝进 x158~159 条带不触发)」(`js/adventure-core.js:832-842`)。
5. **翻越彩蛋是现行口径**:带内可挖可放(东向豁免禁挖禁建),孩子可垫塔翻过栅栏落到 x158~159 隔离带,「再往前是世界硬缘碰撞钳制——无伤害、无传送、看完可翻回来」;给 T7 的硬约束=剪影近看不穿帮(`docs/world-edge-design/east-spec.md:76,119-129`)。
6. **登记在案的反向拍板**:GLOSSARY「边缘传送」词条 _Avoid_:「东向加传送(栅栏彩蛋是收尾不是入口)」(`GLOSSARY.md:389`)。**PO 本次指令(2026-11-13)与该登记相反**——如实并置,裁归 PO/需求线。

### 1.5 主路相关任务链现状(引用面事实)

- q16 任务「去东边的广场看一看」目标=visit_plaza,unlock:'desert',文案「小屋东边有一座石头广场,沿着小径走过去看一看吧!」(`js/adventure-core.js:2888-2891`)。
- 解锁链口径:q16 广场→desert / q19 神殿→snow / q22 雪屋→swamp;「east 查表得 undefined → false 自然语义(无传送方向恒锁)」(`js/adventure-maps-core.js:513-521`)。

---

## 二、边缘传送/维度机制事实

### 2.1 触发线(Edge Trigger Line)

- **声明**:纯几何函数 `advEdgeTransitDirAt(x,z)`(`js/adventure-core.js:832-842`)——north `z<1` / south `z≥WORLD_D−1` / west `x<1`(与碰撞钳制面等效:玩家中心钳在 [hx, W−hx]×[hz, D−hz],hx=hz=0.2);角区检序北→南→西取先;**east 无分支(恒 null)**。
- **触发线只管几何不管权限**:开放判定分离在 `advEdgeOpenDir`(`js/adventure-core.js:823-830`)=调试强制缝 `?edgeUnlocked=1` OR `advEdgeDirUnlocked(dir, advEdgeUnlockCounts)`(复用 advMapUnlocked,`js/adventure-maps-core.js:519-521`);counts 缺省 null=三向全锁。
- **配套近前引导区** `advEdgeHintAt`(`js/adventure-core.js:844-853`):锁定向屏障近前带(北 z≤18/南 z≥140/西 x≤22),东向恒 null;壳层节流 30s(ADV_EDGE_HINT_CD=30,`js/modes/adventure.js:2775-2776`)播分级话术。
- 词条定义:`GLOSSARY.md:391-393`(触发线);_Avoid_「把触发线画成可见墙」「把引导区当第二道触发线」。

### 2.2 边缘传送(Edge Transit)壳装配

- `advEdgeTick(dt)`(`js/modes/adventure.js:2786-2813`):update 每帧,home 图专属(`advDim==='overworld' && advMap==='home'`);早退链=冷却/白闪进行中/睡觉→触发线判据→**开放即 `advVeilFire({to: ADV_EDGE_DIR_MAP[dir], kind:'edge'})`,越线瞬间传送无站桩**(拍板 6);锁定向走近=30s 节流话术。
- 词条定义:`GLOSSARY.md:387-389`(边缘传送全文,含「0.8s 冷却盖过转场窗防连触」「触发线贴碰撞钳制面越线即传送」);回程门挪边词条 `GLOSSARY.md:395-397`(远征图回程门挪边三坐标)。

### 2.3 白闪变体(Veil Edge Variant)——现成参数

| 参数 | 现值 | 引用 |
| --- | --- | --- |
| kind 四值 | `'map'`(缺省,地图门)/`'den'`(副本入口)/`'edge'`(边缘越线)/`'rite'`(解锁让开) | `js/modes/adventure.js:2648-2656` |
| 白闪挂法 | kind='edge'/'rite' → `#portalVeil` 挂 `.edge` class;map/den 维持紫调不挂 | `js/modes/adventure.js:2635-2640` |
| 白闪观感 | 中心暖白 rgb(255 250 240 / 88%)→中段 rgb(255 244 214 / 92%)→边缘 #ffefd0 径向渐变;「忌纯白刺眼忌纯黑(调研 D3 幼儿口径)」;同一元素换装,透明度逐帧直驱仍归基段 | `css/style.css:1115-1124`;基段紫调 `css/style.css:1103-1113`;节点 `index.html:43` |
| 时长 | ADV_VEIL_T=0.4s 单段,淡入+淡出双段共 0.8s;满格瞬间执行到达 | `js/modes/adventure.js:2621,2699-2714` |
| 冷却 | 发令即 `advPortalCd = ADV_PORTAL.cd`(0.8s)盖过整个转场窗防连触 | `js/modes/adventure.js:2658`;`GLOSSARY.md:388` |
| 音效 | 满格瞬间 `advSfx('portal_travel')`(双段式第二段);边缘传送无站桩故无 portal_charge 起步音(那是地图门/巢门站桩的,`js/modes/adventure.js:2738-2740`) | `js/modes/adventure.js:2664` |
| TTS/toast | advVeilArrive 分流:den「你钻进了苦力怕巢穴深处!」/ rite「通往○○的路打开啦!从家的○边一直走就能到!」/ map·edge「到○○啦!」或「回到家啦!」 | `js/modes/adventure.js:2665-2697` |
| 收尾/中断 | advVeilReset:转场归零+遮罩收起+白闪 class 摘除(不渗其他模式);会话复位注册 | `js/modes/adventure.js:2641-2647` |
| 词条定义 | `GLOSSARY.md:399-401`;_Avoid_「把白闪叫第二套转场系统(同一遮罩换 class)」「rite 重建改异步」 | |

### 2.4 维度规格(ADV_DIMS)——行结构/必填字段/氛围受控

- **行结构**(权威两处:`js/adventure-dims-core.js:480-506` 实表;`docs/dimension-registry-design.md:39-58` §2 字段契约):
  ```
  { id,            # 桶键/炉键/BGM 判定的维度标识(≠'overworld')
    build: ()=>{}, # 建场序列闭包(建场直写不记账——互锁红线)
    sky: {color, fogNear, fogFar, sunI},   # 天穹四参数
    mood,          # BGM 曲目键(AudioRegistry 域)
    dayCycle,      # false=dayTime 暂停+恒夜(日月天体随之隐藏)
    spawn: {x,y,z,yaw},  # 进场落点(加载期从结构常量派生)
    hud: {banner, showMobs},  # HUD 横幅行 + 怪物行显隐(维度态不显时段行)
    assets }       # 副本素材预留缝(null=走缺省方块集)
  ```
- **氛围受控机制**:
  - 天穹/雾:`advApplySky(drow.sky)`(`js/modes/adventure.js:2349`);
  - 昼夜:`dayCycleOn = drow.dayCycle`(`js/modes/adventure.js:2350`);
  - 怪刷控制:**切界先 advSceneLeave → `advEntitiesClear()` 实体五池清+回调重挂,实体不跨场**(`js/modes/adventure.js:2281-2283`);维度行本身**没有怪池字段**——下界=恒夜无怪(hud.showMobs:false 隐怪物行,D10,`js/adventure-dims-core.js:491`);den=布防+波次走壳层分支(update 门禁 `if (advDim==='den') advDenTick(dt)` 属「不进表」清单,`docs/dimension-registry-design.md:79-86`);
  - 上界(home/远征图)夜怪池按**地图行** nightPool(替换语义,`js/adventure-maps-core.js:458,471,484`),维度相位期间无环带夜怪(夜怪铺法挂 advDim==='overworld' 的 home/远征图语境);
  - BGM:`advMusicMood(dim,isNight)` 维度行恒行值 mood(`js/adventure-dims-core.js:517-521`);
  - 落点:`ModeKit.spawn(dsp...)` + `setFly(false)`(落地推前进=离开门)(`js/modes/adventure.js:2367-2369`)。
- **切界唯一入口** `advSetDim(dim, spot)`(`js/modes/adventure.js:2311-2378`):换桶(advSceneLeave)→loadScene(drow.build+账本重放+站点重扫+炉键核销)→advApplySky→昼夜门→出生;overworld 分支=advOverworldReload+applyMapPalette+dayCycleOn=true+applyDaylight+advNightReset(`js/modes/adventure.js:2370-2378`)。**nether 期间 advMap 不动**(最后主世界图,`js/modes/adventure.js:2316`)。
- **新维度施工单**(dimension-registry-design.md §6,`docs/dimension-registry-design.md:88-92`):① dims-core 加一行(含 build 闭包与结构常量)② ADV_FURN_PREFIX 加一前缀键(守门测试锁)③ 入口门认领(若走站桩仪式,复用 advGateHold/advVeil);桶键/livestock/HUD/存档兜底/BGM/切界装配全部自动跟随(ADV_SCENE_KEYS 派生)。
- **三条全局判据刻意不设行字段**(§3,`docs/dimension-registry-design.md:60-66`):pos 进档(「维度不进档」`advDim!=='overworld' ? null : {...}`)/死亡语义(单分支切回主世界回家)/分桶键派生(ADV_SCENE_KEYS=ADV_MAPS ids+ADV_DIMS ids)。

### 2.5 现有维度注册范例(各一,原文行)

- **nether 行**(`js/adventure-dims-core.js:481-492`):id:'nether',build=advNetherBuild+advPortalFrame(回程门),sky={color:0x2a0a08, fogNear:26, fogFar:120, sunI:0.3},mood:'nether',dayCycle:false,spawn=(ADV_NETHER.base 派生,yaw:π),hud:{banner:'🌌 下界 · 黑漆漆亮晶晶', showMobs:false},assets:null。
- **den 行**(`js/adventure-dims-core.js:493-505`):id:'den',build=advOreSpotsReset()+advDenBuild(),sky={color:0x07040a, fogNear:18, fogFar:80, sunI:0.12},mood:'nether',dayCycle:false,spawn=(ADV_DEN.base 派生,yaw:π),hud:{banner:'🕳️ 苦力怕巢穴 · 深处', showMobs:true},assets:null。
- (另有「东带」维度?**没有**——东带是 home 图建场的一部分,不是维度;ADV_DIMS 只有上述两行。)

### 2.6 维度触发方式现状(与白闪的关系)

- 副本入口=巢穴之门站桩 2s(advDenDoorAt 认领→伪门对象 {to:'den',kind:'den'} 复用地图门站桩/渐晕整链)→advVeilFire kind='den'→advVeilArrive 里 `advSetDim('den')`(`js/modes/adventure.js:2731-2734,2665-2669`);
- 下界入口=玩家门即时切界(不套站桩,`js/modes/adventure.js:2751-2761`);
- **即:「白闪过场切维度」的整链已存在**(kind='edge' 的白闪 + advVeilArrive 的到达分流),只是现网 kind='edge' 的到达目标只会是 ADV_MAPS 图行、不会是维度行(`js/modes/adventure.js:2686-2693`:kind='edge' 落入 map 到达路径)。

---

## 三、旧缝现状(salvage 素材)

### 3.1 js/modes/town.js 全文结构(151 行)

**纯场景装配件**(与「模式壳」可分,PO 令注「蓝图件与场景装配逻辑与新缝正交」):

| 函数/常量 | 行 | 职责 | 引用面 |
| --- | --- | --- | --- |
| `TOWN_PHASE_ORDER` | :37 | 装配 phase 权威全序 ground→backdrop→road→prefab→scatter→anchor | GLOSSARY「小镇漫步」;`test/town-mode.test.js` |
| `townYawOfFace(face)` | :42-51 | 四正交 face→yaw(前向 (-sin,-cos),引擎 camera-rig lookDir 同式);未知 face 抛拼写域错误 | town.js 内 + 单测 |
| `townSpawnIntent()` | :56-60 | 读 TOWN_MAP.anchors 唯一 spawn 锚 → 站立面 y+1 + 朝向 | townBuild 消费 |
| `townAssemblyPhases(steps)` | :65-72 | 平铺步骤按权威 phase 序分组(组序恒=权威序,只含非空段) | 单测直测 |
| `townConsumeOp(op)` | :81-108 | **op 执行器=引擎触点唯一面**;词表封闭 {fill,tree,scrub,recolor,place}→SceneKit/PrefabKit/voxel | townBuild 逐 op 调用 |
| `townBuild()` | :114-120 | 建场总装:平铺消费 townAssemblyOps(townBuildSteps()) 逐 op 执行;锚点段出生在此收口(先建场后落人,恰一次) | TownMode.init 经 loadScene 调用 |

**交互机**(T-MAP-04 产物,T-UI 线消费):`townTargets` 模式态(:126)、`townInteractBoot()`(:132-135,建交互注册快照与目标状态机,emit 缺省空实现旁路)。

**模式壳**(与「场景装配」的接线层):`TownMode = mkMode({id:'town', init})`(:143-151)——init 全链顺序钉死 ①`loadScene(townBuild)`(场景装填 seam)→②`townInteractBoot()`→③`requestLock()`(U3 点卡直进,无出发页无二次确认)。hud/hotbar/cleanup/update/onKey 骨架期未写(HUD 归 T-UI-01)。

**引擎触点四缝**:loadScene / ModeKit.spawn / requestLock / townConsumeOp(头注释 `js/modes/town.js:28-31`——「vm 记录桩或真引擎替身可全链驱动」)。

### 3.2 依赖件(town.js 头注释 :18-27)

`js/town-map-core.js`(TOWN_MAP/townBuildSteps)· `js/town-assembly-core.js`(townAssemblyOps)· `js/scene-kit.js`(fill/tree/scrub)· `js/prefab-kit.js`(place 蓝图落位)· `js/voxel.js`(getBlock/setBlockRaw)· `js/world.js`(loadScene)· `js/mode-kit.js`(ModeKit)· `js/input.js`(requestLock)。index.html 加载序:town-map-core → town-assembly-core → town-interact-core → modes/town.js → main.js(`index.html:377-380`)。

### 3.3 镇内对接数据(主路进镇后的落点/路网事实)

- spawn 锚唯一:`{id:'spawn', x:79, y:24, z:112, face:'north'}`——南主路上、面北望广场,与钟塔东西对齐 ±2;spawn→钟塔走廊(x±1)全建筑避让(§4.3 回望视线管理)(`js/town-map-core.js:44-47`)。
- roads 清单在 TOWN_MAP.roads(`js/town-map-core.js:85`);城镇布局唯一权威=TOWN_MAP 九段(GLOSSARY「城镇地图核心」,`GLOSSARY.md:253`)。
- 注意:城镇图坐标系(96×96 核心区,z 小=北)与 home 图坐标系(160×160)是**两套独立坐标**,信源中没有两图坐标换算的任何定义(未决,见 §六)。

### 3.4 MODE_REGISTRY 卡与模式页接线

- 注册表行:`{id:'town', name:'小镇漫步', gated:true, page:false, mood:'calm'}`,注释「page:false=U3 点卡直进无出发页; gated 共享儿童时限」(`js/mode-registry.js:32`)。
- index.html 小镇卡:`<div class="mode-card town" id="cardTown">` 🏘️/「小镇漫步」/「逛广场 · 找朋友 · 轻松玩」(`index.html:95-99`);script 四行(`index.html:377-380`)。
- 模式页消费惯例(AGENTS.md 硬规则):「新模式 = index.html 加卡/页/script + mode-registry.js 加行(三重命名有测试断言)」——撤卡时同样的三重命名测试面存在(test/ 下 conventions/boot 断言;具体断言行号未逐条核,查证缺口见 §六)。

### 3.5 ADR-0009 缝定义要点(`docs/adr/0009-town-standalone-mode.md`)

- 决策 1:城镇作为独立游玩模式 `town` 接入(三件套),**不**向 ADV_MAPS 新增城镇地图行,**不**向 ADV_DIMS 新增城镇维度/相位行(:17);
- 决策 3:运行时不并入 adventure 壳、不复用其巢穴/夜怪池/门阵/分桶账本语义;城镇轻状态持久化**不得侵入** `*_world_save` 冒险存档格式(:19);
- 挡回的替代案:并入 ADV_MAPS(「污染池/门/生态数据契约并迫使 adventure 壳分支膨胀」)、并入 ADV_DIMS(「强加无意义相位/战斗政策」)(:20);
- 后果:「与冒险『同一世界连续旅行』的产品叙事需后续通过显式 mode switch/联动票实现」(:25);
- **现状**:PO 指令(2026-11-13)推翻本 ADR,待新 ADR 取代(`.scratch/handoffs/2026-11-13-urgent-po-change-detach-town-entry.md:4`「ADR 级 seam 变更(ADR-0009 待新 ADR 取代)」)。

### 3.6 salvage 相关的停工令事实

- 「停发沿旧缝的实现票:T-UI-01..05 的实现接线票…UI 预排产物(specs/回执)不报废,但**实现动工冻结**」;「已交付物不回滚:T-MAP-01..04、T-PREFAB 全线的蓝图与 core 工件保留(蓝图件与场景装配逻辑与新缝正交,salvage 评估归 architect)」(`.scratch/handoffs/2026-11-13-urgent-po-change-detach-town-entry.md:12-14`)。
- T-MAP 链现状:git log HEAD 前四笔=T-MAP-03(assembly planner)/T-MAP-04(interact registry)落地,T-MAP-01..04 全清,「unblock T-UI-01」(`git log`;`.scratch/handoffs/2026-11-13-tmap-chain-clear-tui-unblock.md` 文件名)。

---

## 四、T-UI-00..05 briefs 引用面盘点

> 只列引用事实与位置;受损判断归 UI 设计工。状态:T-UI-00 已收口(d412cff,T-UI-01 brief:14);T-UI-01..05 均未开工(各 brief「最早可开工条件」未满足)。

| 票 | ui_refs(原文) | 指向文件与 UI 面 | 入口缝相关性(事实归类) |
| --- | --- | --- | --- |
| **T-UI-00**(2026-11-12) | entry-hud-spec **§3(3.1-3.4 入口卡全部小节)、§8(U1-U3)** | 入口卡视觉/文案/过渡(T-UI-00 brief:18);产物=`docs/design/town-ui-entry-tokens.md`(入口卡 token+进出过渡,brief:42) | **指向独立模式入口**:入口卡=index.html 模式卡(brief:32「现有实现参照:index.html 模式卡结构」);进出过渡=「复用 #fade/splash 语言的轻量过渡…可选 TTS『我们去小镇啦』」(brief:38)——**直接建在「独立入口卡」存在的前提上** |
| **T-UI-01**(2026-11-13) | entry-hud-spec **§4(4.1-4.6)、§8(U4-U8)** | 城镇内 HUD 布局/任务提示容器/表扬浮现/TTS 重播(T-UI-01 brief:18,27);落点=css/* 命名空间、index.html HUD 节点、js/town-ui-*(brief:43) | **镇内 UI,与入口缝正交**;但并行冲突段点名与 T-MAP 线「index.html/js/mode-registry.js/js/modes/town.js」的接缝合并序(brief:43)——该接缝句子引用了旧缝文件名 |
| **T-UI-02** | entry-hud-spec **§5(5.1-5.3)、§8(U4/U5)** | Landmark Pointer 方位指引/目标消费(T-UI-02 brief:18,27);资产=marker SVG 占位在 .scratch/town-design/assets/ui/(brief:29) | **镇内 UI,正交**;并行冲突段同点名 js/modes/town.js 接缝(brief:40) |
| **T-UI-03** | entry-hud-spec **§6(6.1-6.4)、§8** | 可交互高亮/标记/点选反馈四态(T-UI-03 brief:18,27);与 T-MAP-03 场景装配(「js/modes/town.js 建场段」)接缝(brief:40) | **镇内 UI,正交**;brief:40 明文引用旧缝建场段路径 |
| **T-UI-04** | dialog-spec **§4-§7、§2** + entry-hud-spec **§0.3、§4.6** | 会话 UI 三件套(气泡/面板/选项)/会话状态机/dialog 接口闭环(T-UI-04 brief:18,27) | **镇内 UI(B 侧),正交**;未引用入口缝文件 |
| **T-UI-05** | entry-hud-spec **全文 §8(U1-U8)** + dialog-spec **全文 §8(B1-B8)** | 联调走查/可达性/文案 TTS 默认值落地(T-UI-05 brief:18,27);走查清单主路径=「**进入**→识别地标→获得提示→点选交互/对话」(brief:33) | **引用面横跨两缝**:U1-U3(入口卡文案/图标/二次确认)在其参数总表引用面内;走查主路径的「进入」一步的语义随入口缝变更而变化——引用事实如此,受损度归 UI 设计工 |

- 补充:T-UI-01..05 全部 brief 的「禁碰 js/prefab-kit.js、test/prefab-kit.test.js」与「DOM/CSS 落点 css/* 命名空间与 js/town-ui-*」约束一致(briefs:42-43,40,41);无一 brief 引用 adventure 侧文件(advVeil*/ADV_EDGE_* 零命中)。

---

## 五、文档现状结构(标题行号)+ 入口卡相关引用位置

### 5.1 docs/town-map-design.md

- 章节:`# 1`(题)· `## 1 目的、范围与口径`(:11)· `## 2 设计原则与约束对齐`(:20)· `## 3 地图布局总览`(:27,含 3.1 规模 :29/3.2 Mermaid :39/3.3 ASCII 块位 :84/3.4 空间母题 :109)· `## 4 功能分区、建筑清单与体量`(:116,含 4.3 路网 :148)· `## 5 氛围设计`(:155)· `## 6 与现有探险模式/注意力训练玩法的结合点`(:178)· `## 7 电影原样/建议调整对照`(:200)· `## 8 待 PO 确认点`(:213)· `## 9 引用与对齐说明`(:226)。
- **入口相关引用位置**:全文仅 2 处「入口」——:140(P1-04 民居「门前花坛/入口区」,镇内建筑门口,与模式入口无关)、:232(「UI 设计定稿:town-ui-entry-hud-spec.md、town-ui-dialog-spec.md(入口卡/HUD/小地图/对话框等边界由 UI 定稿明确)」)。
- **事实**:该文档**没有独立的「入口体验」章**;进入体验的设计定稿实际在 entry-hud-spec §3.3(见 5.2)。「主路径宽 4-5 方块」等路网口径在 §2 表(:35)与 §3.2 Mermaid(:77-79)——那是**镇内**主路,不是冒险侧主路。

### 5.2 docs/design/town-ui-entry-hud-spec.md(分区 A 定稿)

- 章节:`# 1` · `## 0 分区边界与路标`(:11,0.3 A/B 接口 :26)· `## 1 依据与口径`(:37)· `## 2 设计原则`(:54)· **`## 3 城镇模式入口卡设计`(:66)**——3.1 定位(:68)/3.2 视觉文案(:73,含标题「小镇漫步」、副标题「逛广场 · 找朋友 · 轻松玩」、TTS 读法)/3.3 进入城镇的确认与加载过渡(:82:默认无二次确认直接进入;复用 #fade/splash 轻量过渡 0.8-2s;可选 TTS「我们去小镇啦」;落点面向广场或能回望钟塔的方位)/3.4 与现有模式卡一致性(:90)· `## 4 城镇内 HUD 与任务提示`(:97)· `## 5 小地图/方位指引`(:149)· `## 6 交互提示与点选高亮`(:176)· `## 7 口径对照`(:214)· **`## 8 待 PO 确认点`(:225)**——U1 标题/副标题文案(:229)/U2 主图标 emoji 🏘️(:230)/U3 无二次确认(:231)/U4-U8 镇内 HUD 参数(:232-236)· `## 9 引用`(:240)。
- 入口卡相关引用密集区=§3 全章 + §8 U1-U3 + §9(:248「现有 UI 参照(只读):index.html、js/mode-kit.js、js/camp-kit.js」)。

### 5.3 docs/design/town-ui-entry-tokens.md(T-UI-00 产物)

- 章节:`# 1` · `## 0 对齐与边界`(:13)· **`## 1 入口卡 Token 清单`(:22)**——1.1 卡片结构(:24)/1.2 识别色(:37)/1.3 主图标(:51)/1.4 标题副标题文案与 TTS(:60)/1.5 Hover/Pressed(:70)· **`## 2 进出过渡规格`(:81)**——2.1 进入流程默认(对齐 U3)(:83)/2.2 复用 #fade/splash 轻量过渡参数(:88)/2.3 禁止项清单(:99)· `## 3 资产占位清单`(:111)· **`## 4 待 PO 确认项与可参数化落点(对齐 §8 U1-U3)`(:127)** · `## 5 与定稿逐小节对齐说明`(:141)· `## 6 歧义/待需求线裁决`(:155)· `## 7 引用`(:162)。
- 该文档整体是「入口卡+进出过渡」的落地细化,**引用面整体坐落在独立入口缝上**(§2 进出过渡的参数=「点击卡片→过渡→进镇」的线性流程)。

### 5.4 docs/design/town-ui-hud-prebuild.md(T-UI-01..03 预排)

- 章节:`## 0`(:12)· `## 1 共享 Token 与布局基线`(:22)· `## 2 T-UI-01 章:HUD 布局与任务提示容器`(:82)· `## 3 T-UI-02 章:Landmark Pointer 方位指引`(:185)· `## 4 T-UI-03 章:可交互高亮/标记与点选反馈`(:233)· `## 5 纯逻辑函数面(拟下沉 js/town-ui-core.js)`(:279)· `## 6 U4-U8 参数化总表`(:300)· `## 7 资产占位清单`(:338)· `## 8 与设计权威逐小节对齐说明`(:354)· `## 9 歧义`(:377)· `## 10 引用`(:390)。
- 无入口卡章节;镇内 HUD/指引/高亮三个章引用 entry-hud-spec §4/§5/§6(与入口缝 §3 正交)。

### 5.5 docs/design/town-ui-dialog-prebuild.md(T-UI-04 预排)

- 章节:`## 0`(:13)· `## 1 三件套构件落细与 token 化`(:23)· `## 2 会话状态机 × town-ui/dialog/* 接口闭环`(:135)· `## 3 A 侧收敛消费映射`(:199)· `## 4 会话内表扬与 TTS 排队`(:223)· `## 5 状态机纯逻辑函数面`(:265)· `## 6 B1-B8 参数化总表`(:324)· `## 7 资产占位清单`(:341)· `## 8 待 PO 确认项`(:367)· `## 9 歧义`(:383)· `## 10 引用`(:407)。
- 无入口卡章节;B 侧会话 UI 与入口缝正交。

### 5.6 docs/README.md(小镇相关索引行)

- :16 ADR 索引行内「[0009 城镇独立模式](adr/0009-town-standalone-mode.md)」(0009 标题改为新缝后此处描述同步);
- :28 城镇域索引行:town-architecture-design/town-map-design/town-villagers-design/town-assets-requirements/town-prefab-specs + 视觉细化两 spec + 「UI 设计定稿:town-ui-entry-hud-spec.md(**入口卡**/HUD/任务提示/方位指引/交互高亮,分区 A)· town-ui-entry-tokens.md(**T-UI-00 入口卡 token/进出过渡**/占位落地,分区 A)· town-ui-hud-prebuild.md · town-ui-dialog-spec.md · town-ui-dialog-prebuild.md · town-ui-polish-prebuild.md」;
- :35 城镇/电影取证行。

### 5.7 GLOSSARY.md 相关词条(定义段行号)

| 词条 | 行 | 与本变更的关系 |
| --- | --- | --- |
| 边缘传送(Edge Transit) | :387-389 | 「east 恒无传送语义(东向是栅栏小镇收尾,T5 定稿)」在定义正文;_Avoid_ 含「东向加传送」——**本变更需改写该词条的正反两面** |
| 触发线(Edge Trigger Line) | :391-393 | 三向几何+advEdgeHintAt 分向引导带;east 无词条内容 |
| 回程门挪边(Return Gate Relocation) | :395-397 | 远征图回程门挪边三坐标(到达语义) |
| 白闪变体(Veil Edge Variant) | :399-401 | kind='edge'/'rite' 挂白闪;「紫=地图门语义、白=大地让开语义」 |
| 维度规格(ADV_DIMS) | :408-411 | 一行=一个维度全部切界政策 |
| 副本素材(Den Assets) | :413 | assets 预留缝(四供给:方块行/贴图格/建场/建模) |
| 小镇漫步(TownMode) | :444-445 | town 模式骨架壳定义(init 全链/townAssemblyPhases/townSpawnIntent/townYawOfFace interface)——**撤独立入口后词条需重定义或迁义** |
| 城镇地图核心(TownMapCore) | :253 | TOWN_MAP 九段+townBuildSteps;明示消费方「js/modes/town.js 起被 TownMode 的 townAssemblyPhases/townSpawnIntent 消费」——消费方路径随缝变更要跟着改 |
| 探险模式/传送门阵 | :384 | 「home 屋东三扇门阵已于 T9 退役…边缘传送是去远征图的唯一入口」 |

---

## 六、未决事实清单(查不到/存疑,如实列出)

1. **「town-map-design 入口体验章」不存在**:派令与 urgent note 都说「改 town-map-design 入口体验」,但该文档无独立入口章(全文仅 :140/:232 两处「入口」);进入城镇的体验定稿实际在 `docs/design/town-ui-entry-hud-spec.md:82-88`(§3.3)。是否派令方记忆偏差或另有所指,请派令方自裁。
2. **「进入小镇维度」的音/TTS 话术无现成实例**:kind 四值('map'/'den'/'edge'/'rite')无 town;白闪变体的「色」(#ffefd0 暖白系)与「时长」(0.4s×2)、「音」(portal_travel)有现成参数,但到达话术素材只有 den/rite/map 三种句式可参照(`js/modes/adventure.js:2665-2697`)。
3. **城镇维度的刷怪政策声明面**:ADV_DIMS 行无怪池字段(刷怪是壳层「不进表」分支,`docs/dimension-registry-design.md:79-86`);「城镇=无怪/恒白天」在 ADV_DIMS 行形状里如何表达(dayCycle:true? showMobs:false?),信源无现成行可抄——nether/den 两行都是 dayCycle:false。此为设计决策,非事实,仅登记机制边界。
4. **两图坐标系无换算定义**:home 图(160×160)与城镇图(TOWN_MAP 96×96 核心区)坐标系独立,信源中无任何坐标映射/拼接定义;「维度切换=整图 loadScene 重建」的机制下不存在坐标延续问题,但**若设计要「从东带栅栏位置无缝走进镇内 spawn(79,112)」**的落点语义,现有信源无该事实(落点语义是设计决策)。
5. **east 触发线几何与翻越彩蛋的收编口径**:现状 advEdgeTransitDirAt east 恒 null、翻栅栏=彩蛋落到 x158~159(`docs/world-edge-design/east-spec.md:76`);若加 east 触发线,触发几何(在 x157 栅栏线?x158?隔离带?)与彩蛋的去留,信源无答案(设计决策)。
6. **MODE_REGISTRY 三重命名测试断言的精确行号未逐条核**:撤卡会触发的测试面(index.html 卡/mode-registry 行/js 文件三重命名断言)按 AGENTS.md 硬规则存在,但 test/ 下具体断言文件与行号未逐一抄录(时间盒内未展开,需要时查 test/conventions.test.js 与 boot 冒烟)。
7. **showroom(体验馆)对 town 桶的引用**:showroomSceneKeys 由两注册表派生+回落清单(`docs/dimension-registry-design.md:66,101-102`)——若 town 以维度行接入 ADV_DIMS,showroom 派生面自动跟随;若走别的缝,需另查 showroom-core.js 对 town 的显式引用(未核)。
8. **T-UI-00 回执(d412cff)的产物与 entry-tokens.md 的一一对应**已按文档现状确认存在(§5.3),但回执原文(`.scratch/handoffs/2026-11-12-T-UI-00-receipt.md`)未通读——若 UI 设计工需要 T-UI-00 产物完整性审计,需补读。

---

## 附:本调研引用的核心信源清单

**设计权威**:docs/world-edge-map.md · docs/world-edge-design/east-spec.md · docs/adventure-maps-design.md · docs/dimension-registry-design.md · docs/adr/0009-town-standalone-mode.md · GLOSSARY.md · docs/town-map-design.md · docs/design/town-ui-entry-hud-spec.md · docs/design/town-ui-entry-tokens.md · docs/design/town-ui-hud-prebuild.md · docs/design/town-ui-dialog-prebuild.md · docs/README.md
**源码**:js/adventure-core.js · js/adventure-maps-core.js · js/adventure-dims-core.js · js/modes/adventure.js · js/modes/town.js · js/town-map-core.js · js/mode-registry.js · index.html · css/style.css
**派令与票据**:.scratch/handoffs/2026-11-13-urgent-po-change-detach-town-entry.md · .scratch/handoffs/2026-11-12-T-UI-00-dispatch-brief.md · .scratch/handoffs/2026-11-13-T-UI-01..05-dispatch-brief.md
