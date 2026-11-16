# T-NPC-15b 夜间氛围·落位票（定稿 §5-E1 调色板灯罩键 + E2 belfry 夜态增补 + E5 窗光/塔灯落位）

> 波次：**三+（villager-wave4 件二立票，2026-11-17；本线只立票不施工，派工与排期归 scrum）**
> 权威（勿动）：`docs/design/town-night-ambiance-design.md`（案②「灯火归家」定稿，PO 选型 2026-11-16）§2.1（光源件清单与密度口径）/§2.2（件语言基座：色板/载体 A·B/回退）/§5-E1/E2/E5（要点行）；[ADR-0017](../../../docs/adr/0017-town-day-cycle-unfreeze.md) 决策 3/5；`town-visual-revamp-spec.md` §5 红线。
> 票名口径：15a/15b/15c 为 T-NPC-15 票组内序号别称（台账单行挂 T-NPC-15），本票=票组 ②E1/E2/E5 面；**E4 灯罩造型笔不在本票**（归 15c 资产子票，工程票不施工灯罩造型/贴图）。
> 台账：`tickets/README.md` §1 T-NPC-15 行。

## 1. 目标与事实底座

- **E1 调色板灯罩键登记（XS）**：`TOWN_PALETTE`（js/town-assembly-core.js:108，城镇配色映射唯一权威）新增暖金灯罩键，色值对账 **`#E3B23C`**（buildings §4.1 金属-暖金「钟/灯罩/扣件」既定用途）；键名按形/用途命名，终名归本票施工。灯罩造型笔本体（11 处几何）不在本票——键先行，供 15c 引用（定稿 §5-E1「案②街灯完形前置」）。
- **E2 belfry 夜态增补一行（XS-S）**：`docs/design/town-prefab-specs.md` §4.1（:84-88）现文「夜态灯火默认不做」（:87）→ 增补「夜态钟室灯点 1」；载体 A（钟室内灯块 1，烘焙）/B（钟体旁 Basic 暖光面）取舍归本票走查（定稿 §2.2 钟塔灯行）。
- **E5 窗光/塔灯落位（S）**：窗光=民居 A `cottage-gable`（js/town-map-core.js:112 实例 @44,24,71 face south）×1-2 扇 + 民居 B `house-loft`（:113 @42,24,85 face north）×1-2 扇=**2-4 扇**；钟塔灯=`tower-belfry`（:106 @79,24,72）钟室暖点 1。**灯柱零新增**（11 现册 js/town-map-core.js:383-393 零 diff——路径珠串=既有完形零新增光源，定稿 §2.1）。
- **载体先例**：载体 A=窗内侧嵌灯块（id 19 烘焙，屋内同步点亮；玻璃 id 18 全透光=窗光可透，GLOSSARY 光照核心差异 #7；同族在册=shop-awning `signLight/glow:19` assembly:114、stash `porchLamp:19` :122，且 porchLamp v 注入+世界系 fill 笔先例 assembly:466-468）；载体 B=Basic `#FFD89A` 小面片不进光场（零逐帧先例=风车叶片 dims:565-566；若定案含载体 B，该面依赖 15a 门控机制先行——软边，§5）。
- **密度护栏（定稿 §2.1 写死）**：灯柱零新增、新增光源点 3-5、总暖点 ≤18；全镇低密度+节庆点缀 <15%（buildings §6.3）口径不变。文档债注记：town-map-design §5.2/buildings §6.3 夜态翻牌已随定稿落地（定稿 §5 备注第一条），本票零重复翻牌。

## 2. 文件域（README §6 立票规约逐条回应）

| 文件 | 动作 | 说明 |
|---|---|---|
| `js/town-assembly-core.js` | 改 | TOWN_PALETTE 新键（E1）+ 窗光/塔灯 fill 笔与材质注入（载体按走查定案；prefab 段消费=place/ fill 派生 ：443-476） |
| `js/town-map-core.js` | 改（可选） | 仅当点位/v 参数需清单条目承载（**预期不触 lamp 清单段 ：359-393——灯柱零新增=结构保证**） |
| `test/town-assembly-core.test.js` | 改 | **钉值全表转录同步**（:224「TOWN_PALETTE 全表独立字面量逐键相等（设计权威转录，防漂移）」——多键少键换值皆红，PALETTE_WANT 必随 E1 改源）；place 数断言（:240-242）与危险旗标断言（:218）开工前复核——fill 笔不增 place 数、id 19 已在册先例，**零翻新预判** |
| `test/town-map-core.test.js` | 改（可选） | 仅当触清单段必同步同名单测（预期不触发） |
| `docs/design/town-prefab-specs.md` | 改 | §4.1 belfry 夜态增补一行（E2，保留原文改写注记体例）；其余节零触碰 |
| `docs/design/town-visual-revamp-spec.md` | 改 | §5 键集红线句（:179-180「TOWN_PALETTE 键集（值可重映射，**新增键需登记**）」）就近登记新键：键名/色值 `#E3B23C`/用途=灯罩造型笔用色（供 15c 引用） |
| 本票面 + `tickets/README.md` | 改 | 施工记录回填 + 台账行状态列（**他行勿碰**） |

**红线（不在文件域=结构保证）**：`docs/design/town-night-ambiance-design.md` 定稿勿动 · TOWN_MAP 坐标唯一权威/PrefabKit footOf 语义/v 变种键集=行 defaults（revamp-spec §5 契约不变）· lamp 清单段零 diff · 零 HUD 新件、零新音频、零逐帧 PointLight（定稿 §3.c/§3.d）· `js/config.js` 现役块字段零改（见 §3 复核项 1）。

**行号漂移告诫**：立票日行号 @`81c2806` 树；town-map-core/assembly-core 为多线共用热件，施工以语义 grep 定位。

### 2.1 §6 固定问句（债 3）：「本票是否有生成器/导出器会再生成既有产物？」

**无。** 调色板/清单/fill 笔全手改；gen 导出链/mob-look 档案/golden fixture/UI 资产生成器零关联。

### 2.2 债 5 守门改源条款：**触发**

钉值全表转录（:224）属设计权威转录测试改源——按 README §6 自动追加规范回写：**revamp-spec §5 键集登记与本改同票同收口，两改不许拆期**（判例：T-NPC-01/03 改源后规范滞后的 retro 债 5）。GLOSSARY 零词条变动预期（调色板键非模块 interface，收词判据不满足）；词条计数勿手数，收尾跑 `node --test test/conventions.test.js` 的 GLOSSARY 断言验平。

### 2.3 顺改条款（DLG-01 §8 挂账承接，条件触发）

本票文件域不含 `css/town.css`（纯世界内 3D 面，预期不触发）。**若施工实际展开确需触 css/town.css**：须同票顺手摘抄在册两条挂账——①reduced-motion 降级块锚定档（bubble-in-anchored）动画字面补行；②豆影 `--town-dlg-shadow-far` 单源化（登记处=`.opencode/power-luna/feedback/2026-11-16-vw3-train-engmgr-retro.md` :65；其「票面 §8 在册」注与 DLG-01 票面实测不符已报备，引用以 retro 为准）。

## 3. 施工前复核项（立票人已核并给默认；施工方复核后按默认落，有异议回票登记，不擅自改）

1. **暖金色档落点（开放点，给默认）**：现役世界块面（js/config.js BLOCKS 0-19）无 `#E3B23C` 暖金字面档（石英 17≈[0.90,0.88,0.82] 偏白、金属 12≈[0.47,0.49,0.53] 灰）。键值三路：**默认=优先既有族块或既有 atlas 薄片件**（thin 豁免先例=门额牌 sign 槽 80）；若走查裁定须**新增块或新增 atlas 件**：在票面施工记录登记并回执需求线，零静默新增（revamp-spec §5 红线精神+定稿 §2.1「调色板新增键需按 revamp-spec §5 红线登记」）。灯罩造型几何本体=15c 面，本票只落键。
2. **点位避让**：窗光点位避让门窗开合与花坛（定稿 §2.1；花坛注记 map-core:413 在册）；民居 face 向与室内可见性走查定扇位。
3. **溢光回退预案在册（定稿 §2.1）**：窗光灯块芯实屏过亮（BFS 溢光）→ 降为每栋 1 扇；钟室灯喧钟 → 降档檐下弱光面。逐点独立零耦合、可逐点摘除。

## 4. 验收标准（定稿 token 与落位逐项对账；终验=PO 实屏夜档走查，归上游排期）

| # | 项 | 落值/判据 | 定稿出处 |
|---|---|---|---|
| 1 | E1 键登记 | revamp-spec §5 :179-180 就近登记（键名/`#E3B23C`/用途）+ 钉值 PALETTE_WANT 转录同步，**两处同 commit**（债 5 两改同收口） | §5-E1 · revamp-spec §5 |
| 2 | E2 增补 | prefab-specs §4.1 belfry「夜态灯火默认不做」→ 增补「夜态钟室灯点 1」（改写注记体例保留原文沿革） | §5-E2 · §2.2 钟塔灯行 |
| 3 | E5 窗光 | 民居 A 1-2 扇+民居 B 1-2 扇=2-4 扇，暖面 `#FFD89A`；载体 A/B 走查定案留痕（§3 复核项 2 避让兑现） | §2.1/§2.2 |
| 4 | E5 塔灯 | 钟室暖点 1（载体 A/B 走查定案留痕），对齐 home 侧剪影「塔灯 1」互文 | §2.1/§2.2 |
| 5 | 密度护栏 | 灯柱零新增（lamp 清单段 diff 空）、新增光源点 3-5、总暖点 ≤18 | §2.1/§3.c |
| 6 | 守门面 | 钉值逐键相等绿；place 数=13 零翻新（复核条款兑现留痕）；危险旗标断言零翻新；town-map 同名单测同步绿（若触） | pintest :218/:224/:240-242 |
| 7 | 门控衔接 | 全载体 A=烘焙类零门控（天然渐显，15a 零依赖）；含载体 B 则该面与 15a 机制联检渐变窗（软边兑现留痕） | §3.b 载体分野 |
| 8 | 回退面 | 摘灯块回现状/逐点摘除零耦合预案留痕（执行归走查，本票登记即可） | §2.1 |
| 9 | 安全叙事 19 项逐项对账+零 HUD/零音频（口径同 15a §4.5：§3.d 六+§A.6 七+buildings 五+术语纪律一） | 附出处逐项 ✓ | §3.d/§4 |
| 10 | gates+提交 | `npm test` 当值全量 0 红+`npm run lint` 三关零错+conventions 验平；提交纪律=§6 惯例条款 | — |

## 5. blocking edges

**无跨线硬边**（定稿已定）。票内软边注记：①若载体走查定案含载体 B（自发光面片）→ 该面依赖 **15a 门控机制**先行（全载体 A=烘焙灯块则零依赖）；②E1 产出键名供 **15c 灯罩造型笔**引用（15c 方案可先以色值 `#E3B23C` 表达，键名后回填）。均为施工次序注记，终裁归 scrum。

## 6. 施工排期注记与惯例条款（终裁归 scrum，票面只如实注记冲突面）

- **施工排期注记（villager-wave4 件二派令定）**：串行排在 **T-NPC-13 c2 面**之后（同 worktree 单线纪律，scrum 执行）；与 c2 同树时 town-map-core/assembly-core 若被 c2 面触碰，以语义定位互勿触碰。
- **惯例条款（随车纪律照抄）**：①随车/自有 commit 一律落**当期在飞分支**（立票日=`t-npc-13-c2-schedule`，切换以 scrum 指针为准——stranded rider `6370ae5` 教训）；②**任何落 main 的 commit 先全量门、0 红才并**（雪球 `1a050a1` 实证）；③自有 commit **零裹挟**（只 add 本票文件域，瞬态日志勿裹挟 §7.7）；④conventions §7.3 Windows 纪律拆单条 commit、多 `-m`；⑤台账行更新与票面施工记录同一 commit；⑥装具 vm 装载制不绑 8080（勘误在案，仅手工 server.js 场景需注意）。

## 7. 证据指针

- 定稿 `docs/design/town-night-ambiance-design.md` §2.1/§2.2/§3.c/§3.d/§5-E1/E2/E5（唯一权威）。
- 代码锚点（立票日 @`81c2806` 树）：js/town-assembly-core.js :108-132（TOWN_PALETTE 七段+prefab 行）/:443-476（road curb fill+prefab 消费/porchLamp v 注入先例）· js/town-map-core.js :106/:112/:113（belfry/民居实例）/:359-393（灯柱构图意图+11 柱清单）/:413（花坛）· js/config.js :241-248（块面色表，无暖金字面档=复核项 1）。
- 测试锚点：test/town-assembly-core.test.js :218（危险旗标）/:222-229（钉值全表）/:233-242（place 数 13）。
- 规格：town-prefab-specs §3（环境道具不入行表）§4.1（:84-88）；town-visual-revamp-spec §5（:176-182 红线）；GLOSSARY 光照核心差异 #7。
