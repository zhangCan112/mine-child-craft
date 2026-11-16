# T-NPC-15a 夜间氛围·门控机制票（定稿 §5-E3：clockPhase 四段渐变窗，自发光面片载体专用）

> 波次：**三+（villager-wave4 件二立票，2026-11-17；本线只立票不施工，派工与排期归 scrum）**
> 权威（勿动）：`docs/design/town-night-ambiance-design.md`（案②「灯火归家」定稿，PO 选型 2026-11-16）§3.b（门控设计意见）/§5-E3（要点行）/§2.2（载体分野）/§3.c（性能护栏）/§4（红线自查）；[ADR-0017](../../../docs/adr/0017-town-day-cycle-unfreeze.md) 决策 4（clockPhase 四段）/决策 5（夜档定稿权归设计线——本票只施工机制，不重开观感裁决）。
> 票名口径：15a/15b/15c 为 T-NPC-15 票组内序号别称（台账单行挂 T-NPC-15），本票=票组 ①E3 面；检索勿串 T-NPC-13/14。
> 台账：`tickets/README.md` §1 T-NPC-15 行（本票组三票同行注记）。

## 1. 目标与事实底座

按定稿 §5-E3 给**自发光面片类载体**（定稿 §2.2 载体 B：Basic `#FFD89A` 观感面，不进光场）实现 dusk/dawn 渐变窗门控机制。机制归工程票（定稿公共裁决 b 逐字：「门控机制（怎么实现渐变）归工程票；『何时亮』是模式政策」——政策缝先例 setPlayerGlow，js/world.js:371「政策『何时亮』归模式层」）。

- **亮灯窗锚点（定稿 §3.b 逐字，零新枚举零新魔法数）**：clockPhase 四段断点=DIM_KEYS 折线转折 tick（js/daylight-core.js:30 `[[0,0],[12040,0],[13670,11],[22330,11],[23961,0]]`；:125-135 clockPhase）。**dusk 段 12040→13670 ≈82 秒渐暗窗：灯随天暗渐亮**；**dawn 段 22330→23961 ≈82 秒渐亮窗：灯随天亮渐熄**——因果读法「天黑了，灯亮了」，不是「灯突然出现」。
- **量化节拍先例**：50 tick 比较键（js/world.js:178 `Math.floor(t / 50)`）+ 云朵亮度键写值（:190-191 `cloudB` setScalar）——「Basic 类亮度按 50 tick 键写值」现成先例（≈2.5 s 一阶、颜色阶进无感），禁瞬亮瞬灭（§A.6 惊吓闪禁项直接覆盖灯光开关场景）。
- **载体分野（定稿 §3.b，结构保证）**：烘焙灯块类（灯柱 11/店灯 signLight/挂灯 porchLamp，灯块 id 19 `light:15` 烘进顶点 aBlock，js/config.js:247）**零门控需求**——白天日光通道主导、夜里自然显为灯火，现状灯柱已在示范。**本票机制只服务自发光面片类，不得给烘焙类加任何开关/衰减**。
- **术语红线**：dayTime tick 裸常量散写回消费方=GLOSSARY「昼夜核心（DaylightCore）」_Avoid_ 明文（「把折线/窗口判据散写回消费方」）——断点读数一律走 clockPhase/DIM_KEYS 折线。

## 2. 文件域（README §6 立票规约逐条回应）

预期触碰面（落法施工裁，文件域以实际 diff 为准，**越界即废票**；「可选」=该落法路径才触）：

| 文件 | 动作 | 说明 |
|---|---|---|
| `js/daylight-core.js` | 改（可选） | 渐变因子读数面：若需新导出，窗内进度因子 `f(dayTime)∈[0,1]` 纯函数（断点读 DIM_KEYS，零新常量）；**同名单测 `test/daylight-core.test.js` 必同步**（动源码必同步同名单测，revamp-spec §5 工程门） |
| `js/world.js` | 改（可选） | applyDaylight 广播段挂夜灯因子（云朵 :189-191 同款 50 tick 键写值路）；**setPlayerGlow（:371-382）零触碰**（不作夜灯扩充理由，定稿 §3.c） |
| `js/adventure-dims-core.js` | 改（可选） | town 维度 mesh 面=载体 B 面片挂点；零逐帧 Basic 先例=风车叶片（:565-566/:607）；op 消费=townConsumeOp（:623-661） |
| `js/modes/adventure.js` | 改（可选） | town 分支「何时亮」政策缝（如需模式级政策；与 T-NPC-13 c2 面**同文件不同段**——c2=update 镇民段，本票不触镇民段，见 §6 排期） |
| 新文件 | 允许 | 按 conventions §1 决策树；`-core` 纯核心必配同名单测 |

**红线（不在文件域=结构保证）**：`js/config.js` 灯块 id 19 字段零改（烘焙类零门控）· 零逐帧 PointLight/零逐帧更新对象 · 低核分档参数零新增（ipad5-performance-design §0 表无动态光源预算行，定稿 §3.c）· `docs/design/town-night-ambiance-design.md` 定稿勿动 · GLOSSARY「昼夜核心/光照核心/小镇维度」词条口径零倒退。

**行号漂移告诫**：立票日行号 @`81c2806` 树；定稿 §6 引用指针为其 2026-11-16 核图值（部分已漂，如 town-map-core 灯柱清单实为 :383-393）——施工一律按语义 grep 定位。

### 2.1 §6 固定问句（债 3）：「本票是否有生成器/导出器会再生成既有产物？」

**无。** 纯 js 机制+单测；gen 导出链/mob-look 档案/golden fixture/UI 资产生成器零关联。

### 2.2 债 5 守门改源条款复核

**预期不触发**：daylight-core 同名单测为行为断言件，非白名单/守门改源类；conventions/GLOSSARY 无对应表述需回写。若施工新增 `-core` 模块且入 GLOSSARY 收词判据（≥2 文件引用），按规约同票回写；GLOSSARY 断言随车验平（`node --test test/conventions.test.js`）。

### 2.3 顺改条款（DLG-01 §8 挂账承接，条件触发）

本票文件域不含 `css/town.css`（纯世界内 3D 面，零 HUD 新件=定稿红线，预期不触发）。**若施工实际展开确需触 css/town.css**：须同票顺手摘抄在册两条挂账——①reduced-motion 降级块锚定档（bubble-in-anchored）动画字面补行；②豆影 `--town-dlg-shadow-far` 单源化（scrum 终裁登记不立票、归属域顺改；登记处=`.opencode/power-luna/feedback/2026-11-16-vw3-train-engmgr-retro.md` :65；该 retro 注「票面 §8 在册」与 DLG-01 票面实测不符，已报备 scrum——本票引用以 retro 为准）。15b/15c 同款条款各自在册。

## 3. 施工形状（纪律定死，落法红方裁）

- **渐变纪律（定稿 §3.b 逐字）**：dusk 渐亮/dawn 渐熄两窗各 ≈82 秒；窗外稳态恒值（day 熄稳/night 亮稳），零呼吸、零闪烁、零随机；窗端点四断点（12040/13670/22330/23961）处因子连续无跳变。
- **量化节拍**：50 tick 比较键（world.js:178 同款），云朵手动跟同一折线即「Basic 亮度键写值」承载路；零逐帧更新。
- **载体 B 材质**：Basic `#FFD89A`（定稿 §2.2），亮度跟随因子；不进光场、零光源对象、个位数面片（定稿 §3.c）。
- **机制不绑点位**：本票只交付机制与因子（最小接口面，政策缝先例「何时亮归模式层」）；面片落位=15b 消费方。

## 4. 验收标准（红绿可测）

1. **因子单测（核心层）**：dusk 窗内随 dayTime 单调升、dawn 窗内单调降、四断点连续、窗外恒值；红能力自证（先红后绿，conventions §7.4 红因分类留痕）。
2. **门控行为钉**：载体 B 代表面片亮度随 50 tick 阶进在窗内渐变、窗端点无跳变；「禁瞬亮瞬灭」可测=窗内相邻键差有界（值界施工定并留痕）。
3. **烘焙类零变化钉**：既有灯块暖点（11 柱/店灯/挂灯）昼夜行为回归零漂移——world-vertexlight 7 测及 town 相关钉原文全绿。
4. **性能护栏**：零新增逐帧 PointLight；夜档 vs 日档 renderer.info（HUD 1Hz）基线差走查留痕，新增面片个位数（定稿 §3.c 验收观测）。
5. **安全叙事 19 项逐项对账**（附出处逐项 ✓）：19 项=定稿 §3.d 表 6 项+§4 之 §A.6 表 7 项+buildings §4.2/§6.3 表 5 项+术语纪律自查 1 项；§4 第三表（安全叙事底线 5 行）系 §3.d 同义复述+revamp-spec 红线行，随逐表打勾不另计数。
6. **gates**：`npm test` 当值全量 0 红 + `npm run lint` 三关零错 + conventions GLOSSARY 断言验平（**以施工日当值基线为准，勿引立票日数字**）。
7. 提交纪律见 §6 惯例条款。

## 5. blocking edges

**无硬边**——定稿已定，机制独立可先行。票内软边注记：15b 落位票若走查定案含载体 B（自发光面片），该部分面依赖本票机制先行（全载体 A=烘焙灯块则零依赖）；非跨线硬边，施工次序终裁归 scrum。

## 6. 施工排期注记与惯例条款（终裁归 scrum，票面只如实注记冲突面）

- **施工排期注记（villager-wave4 件二派令定）**：串行排在 **T-NPC-13 c2 面**之后（同 worktree 单线纪律，scrum 执行）；与 c2 同树时注意 adventure.js 同文件不同段（c2=update 镇民段；本票若触=advSetDim/setSkyBase 邻段），以语义定位互勿触碰。
- **惯例条款（随车纪律照抄）**：
  1. 随车/自有 commit 一律落**当期在飞分支**（立票日=`t-npc-13-c2-schedule`；在飞分支切换以 scrum 指针为准——stranded rider `6370ae5` 教训：落错分支=孤儿账）；
  2. **任何落 main 的 commit 先全量门、0 红才并**（雪球 `1a050a1` 实证，四门条款）；
  3. 自有 commit **零裹挟**：只 `git add` 本票文件域，同树未跟踪瞬态日志勿裹挟（§7.7）；
  4. conventions §7.3 Windows 纪律：拆单条 commit、多个 `-m`；
  5. 台账行更新与票面施工记录**同一 commit**（T-NPC-13 retro 收口纪律）；
  6. 测试装具 vm 装载制**不绑 8080**（8080 勘误在案，仅手工 `node server.js` 场景需注意；旧票面陈旧 8080 注记不再沿用）。

## 7. 证据指针

- 定稿 `docs/design/town-night-ambiance-design.md` §3.b/§5-E3/§2.2/§3.c/§4（唯一权威）；ADR-0017 决策 4/5。
- 代码锚点（立票日 @`81c2806` 树）：js/daylight-core.js :30/:125-135 · js/world.js :173-191/:187-188/:371-382 · js/adventure-dims-core.js :565-566/:607/:623-661 · js/config.js :247。
- GLOSSARY「昼夜核心（DaylightCore）」_Avoid_ 折线散写、「光照核心（LightCore）」差异 #7 玻璃透光、「小镇维度（Town Dimension）」。
