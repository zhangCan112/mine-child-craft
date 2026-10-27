# 数学冒险岛 · 实现设计

> 需求定稿：`docs/math-mode-plan.md`（D1~D9 已拍板，2026-10-24）。研究支撑：`docs/math-thinking-research.md`。
> 本文是三段式的 design 段：分层与文件、呈现双轨、难度双轨数值、存档与政策接线、测试计划、实施切票。数值口径与 plan §4/§6 一致，冲突以 plan 为准。

---

## 1. 目标与非目标

**目标**：新增训练营类模式"数学冒险岛"（id `math`）：100 关关卡地图（六族 × 四学期带螺旋混编），难度按"数值跟带、思维跳到附加题"双轨设计；复用专注训练营成关框架（三星/每日预算/TTS 零文字/过程性表扬/战利品）与既有引擎 seam，引擎层零改动。

**非目标**：家长加时通道（focus 也没有，需要时按 `readExtraMs` 模式加 `math_extra_save`）；魔鬼特训/每日体检（focus 专属，观察孩子玩数学的热度再议）；触屏适配、账号系统（MISSION 约束）。

## 2. 分层与文件（一文件一模块）

| 新文件 | 层 | 一句话职责 | 单测 |
| --- | --- | --- | --- |
| `js/math-levels.js` | 库层（数据+纯函数） | 数学关卡数值唯一权威：六族元数据、四带数值轴、paramsFor 双轨曲线、100 关编排、通过门槛/三星（挑战挂钩）、战利品表与掷骰、存档默认值/迁移 | `test/math-levels.test.js`（vm 直测，零 THREE 零 DOM） |
| `js/math-puzzles-core.js` | 引擎无关纯核心 | 出题与判分的纯数据变换：镜像/平移/旋转图案、图纸投影、隐藏块与露面计数、数列与周期、合成多解枚举、天平代换链、线索排队、间隔问答 | `test/math-puzzles-core.test.js`（种子注入，同 seed 同输出） |
| `js/math-paradigms.js` | 库层（DOM 惰性） | 屏流判别引擎：A/B/F 族及情境关的"呈现-点选-反馈"小部件与 runMathScreen 流程（focus-paradigms 同构，零 THREE） | `test/math-paradigms.test.js`（注入假 doc，vm 直测） |
| `js/modes/math.js` | 模式层 | 装配：入口/今日页/地图页/结算/图章/家长面板 + 世界族（C/D/E）场景装场与交互接线 | boot.test.js 全链冒烟兜底 |
| `css/math.css` | 样式 | 屏流与地图样式（focus.css 同款纪律：DPR 自适应、TTS 时无文字依赖的图标语言） | — |

既有文件触点：`js/mode-registry.js` 加一行 `{id:'math', name:'数学冒险岛', gated:false, page:false}`；`index.html` 加卡 `#cardMath` + css + 4 个 script（加载序：icons → math-levels → math-puzzles-core → math-paradigms → modes/math）；`js/main.js` MODES 表加 `math: MathMode`、`setupBudgets` defs 加 math 预算、`js/daily-budget.js` 加 `MATH_DAILY_LEVELS=6` / `MATH_DAILY_MIN=20` 常量（与 FOCUS 同址）。**引擎层（world/voxel/mesh 等）零改动。**

模块头注释走 `====` 五要素契约（conventions.md §1.7），样式对照 focus 三件套。

## 3. 呈现双轨（关键架构决策）

六族按"玩法发生在哪"分两轨，出题与判分统一走 `math-puzzles-core` 纯函数，两轨只差"数据怎么演"：

| 轨 | 覆盖 | 承载 | 复用 seam |
| --- | --- | --- | --- |
| **屏流轨**（DOM） | A 数一数全变体、B 算一算全变体、F 找一找全变体、C 的站位比大小、情境关（商店/钟表/测距） | `runMathScreen(variant, params, cb)`：数量选择条/方块堆/序列槽/天平/线索卡/背包清单等小部件 | focus 屏流骨架、SpeechKit、mcIcon 族图标、TextureAtlas 单格雪碧（focus 矿洞皮肤同款） |
| **世界轨**（3D 场景） | C 的掷骰前进/跳格子任务/间隔问题/规律跳；D 摆一摆全变体；E 搭一搭全变体 | 谜题数据 → SceneKit/loadScene 装场；点选放置/走子交互；固定或跟随相机 | loadScene 装场纪律、SceneKit、Avatar 走路、CameraRig、Fx 庆贺、建造模式的瞄准放置交互形态 |

- **图纸不拍照**：E 族的俯视图图纸由 `projectTop` 纯函数投影后用 canvas 画 2D 像素图，不用引擎相机远拍（简单、可单测、零渲染风险）。
- **世界轨隔离**：每关装一个独立小场景（≤ 32×32），退出即清场（loadScene 清场幂等）；不与建造存档互写。
- **世界轨放置交互**：复用"准星所指即所操作"的 aim 射线（CameraRig.aim），点选放置/移动方块；不做键盘依赖（MISSION：纯鼠标点选）。

## 4. 关卡数据与难度双轨

### 4.1 数据形状

```
MATH_LEVELS[i] = { i, band(0..3), family(A..F), variant, tier(1..19),
                   kind: 'tutorial'|'normal'|'challenge'|'review'|'boss', params }
```

- **族与变体**：`MATH_FAMILIES = ['count','craft','hop','mirror','plan','pattern']`（A 数一数 / B 算一算 / C 跳一跳 / D 摆一摆 / E 搭一搭 / F 找一找）；每族 `VARIANTS = {常规×3, challenge×1}`（plan §6 的 ★/★★ 清单）。
- **编排**（每带 25 关）：带 0 首两关为六族教学关的子集（教学关共 6 关，拆在带 0 前段）；每带 = 1~2 关带首复习（带 0 无）→ 六族轮转（A→B→C→D→E→F，B/C 配重略高）→ 每族末次出现 = `challenge`（★★）→ 带末 1 关 `boss`（三族 ★★ 串联）。tier = `band*4 + k`（k=带内第几次出现，1..4，顶格 19 截断）。
- **paramsFor(family, tier, li)**：每族一张曲线，字段分两轨——**数值轨**（该带允许的最大数：`RANGES = [20, 100, 100, 10000]`，带内再随 tier 微升）与**推理轨**（`reasoning: 'single' → 'two-step' → 'reverse' → 'multi-solve'`，tier 分段）；定性跳变概率渐进混入（台阶变坡道，focus 先例）。每族曲线表在设计实现时以 focus-revamp §2 的 D1~D5 表样式逐族给出，拍板进 `math-levels.js` 注释。
- **认知负荷红线**（research §2.6，写入曲线公共约束）：一次呈现目标数 ≤4 组块；线索关 ≤3 条线索；每关只动一个难度维度。

### 4.2 通过门槛 / 三星（挑战挂钩，plan D4）

```
mathPassed(level, st): tutorial 恒过；acc ≥ 0.70（自适应训练带下界，同 focus）
mathStars(level, st, famChallengeDone): ⭐通过 ⭐⭐ acc≥85%
  ⭐⭐⭐ acc≥95% 且无连续 3 错，且该族当带 challenge 关已通过（famChallengeDone 注入，存档查表）
```

- 回放挑战关通过后，同族同带常规关的第三星**回溯点亮**（地图星显刷新）。
- 挑战关自身：通过门槛提到 acc ≥ 0.80（附加题水平，plan D3）。
- `boss` 关三段串联，聚合三段 acc 按单关口径结算。

### 4.3 存档

`math_camp_save`（SyncDB.slot，defaults/migrate 住 math-levels.js 可单测）：

```
{ stars: {关i: 星数}, challenge: {'family:band': true}, stamps: {日期: 当日关数},
  stampKind: 自选章图案, log: {日期: {family: {acc, n, chal}}} } // 滚动 90 天，家长面板数据源
```

## 5. 政策与回路接线

- **每日预算**：`Budgets.math = {capMsFor: ()=>MATH_DAILY_MIN*60*1000, capCount: MATH_DAILY_LEVELS}`（main.js setupBudgets defs 加行）。时长入账照抄 focus ticker（关内每秒 accrue，菜单/地图页不计）；关数在结算时 `b.count()`。锁定体验同 focus：额度尽 → 今日页锁定文案 + 明天再来。
- **入口与退出**：主菜单卡 `#cardMath`（mode-registry `gated:false` + `page:false`，三重命名断言自动覆盖）；点卡进 `MathMode.init()` 全屏接管，返回清场。
- **战利品**：`MATH_LOOT` 按族主题化（count→怪物掉落系、craft→矿物系、hop→彩色染料系、mirror→玻璃/石英系、plan→木材系、pattern→花与染料系），掷骰政策与 focus 同构（正确 p=0.45、连 3 保底稀有池、教学关豁免、只奖不罚），`rollMathLoot` 种子可注入；入包走共享 Backpack（`grantMathLoot` 与 grantFocusLoot 同形态），结算屏列队回顾（D8：战利品互通，图章独立一本）。
- **话术**：`MATH_PRAISE / MATH_COMFORT` 数学向过程表扬（"你倒着也想出来了！""你按顺序一个一个数，真仔细！"——夸方法与努力，Mueller & Dweck 1998）；规则播报 `MATH_META[family].rule` + 变体级补充，全走 SpeechKit，零文字依赖（数字符号本身是学习对象，允许出现）。
- **家长面板**（modes/math.js 内，focus 家长面板同款）：六族 × 四带正确率矩阵、思维挑战通过率单列（challenge 遇到/通过计数）、CSV 导出；只报过程指标（research §5 口径，D9）。

## 6. 测试计划

| 层 | 断言要点 |
| --- | --- |
| math-puzzles-core | 每类谜题：同 seed 同输出；答案正确性（隐藏块计数手算对照、周期取模、多解枚举不重不漏、镜像判分含平移/旋转轴）；数值范围跟带（越带出数为红线） |
| math-levels | paramsFor 双轨：数值轨不超前（band0 永不出现 >20）、推理轨单调递进；100 关结构：每带每族出现次数符合配重、末次=challenge、带末=boss；mathStars 挑战挂钩（未过挑战则常规关封顶 2 星、补过回溯）；rollMathLoot 概率边界（池概率和=1、教学豁免、连对保底）；migrate 幂等 |
| math-paradigms | 注入假 doc：试次流、正确/错误反馈回调、TTS 挂钩、chunks ≤4 红线参数不越界 |
| boot 冒烟 | 新 script 加载序、模式卡点击进/出、预算锁定路径不崩 |
| 守门 | conventions.test.js（文件命名/头注释五要素/mode-registry 三重命名对 index.html 断言）自动覆盖新文件 |

## 7. 实施切票（每票独立可合，收尾跑 npm test + npm run lint）

| # | 票 | 内容 | 依赖 |
| --- | --- | --- | --- |
| T1 | 接线骨架 | mode-registry 行 + index.html 卡/css/script + main.js MODES/math 预算 + math.js 入口/退出/锁定/今日页空壳 + GLOSSARY 词条占位 | — |
| T2 | 关卡库 | math-levels.js 全量（曲线/编排/门槛/战利品/存档）+ 单测 | T1 |
| T3 | 谜题核心 | math-puzzles-core.js 全量 + 单测 | —（可与 T2 并行） |
| T4 | 屏流引擎 | math-paradigms.js（A/B/F 变体 widgets + runMathScreen）+ 单测 + math.css | T2, T3 |
| T5 | 世界轨·跳一跳 | C 族线性路装场 + Avatar 走子 + 跳格子/间隔交互 + 结算接线 | T2, T3 |
| T6 | 世界轨·摆与搭 | D/E 族场景装场 + 放置交互 + 图纸 canvas 投影 | T2, T3 |
| T7 | 情境挂载 | 商店/钟表/测距（复用屏流引擎）+ boss 关串联 | T4 |
| T8 | 激励回路 | rollMathLoot 入包 + HUD 飞入 + 图章 + 结算屏 + 表扬话术 | T4 |
| T9 | 家长面板与收尾 | 面板矩阵/挑战通过率/CSV + GLOSSARY 词条转正 + 全量 test/lint | T1~T8 |

风险与对策：世界轨交互（T5/T6）是最大不确定块——票内先做"点击走子/放置"的最小可玩，观感迭代后置；若放置交互超期，D 族首期可降级为"点选候选块"（仍在世界内点选，不做自由放置），不改变出题与判分。

## 8. GLOSSARY 词条草案（T9 录入）

- **数学冒险岛（MathMode）**：第一学段数学思维训练营模式；100 关地图=六族×四带螺旋，难度双轨（数值跟带、思维附加题级）。_Avoid_: 数学模式（散称）、数学游戏
- **数学关卡参数表（MathLevels）**：`js/math-levels.js`，数值唯一权威。_Avoid_: MATH_LEVELS 影子表
- **谜题纯核心（PuzzleCore）**：`js/math-puzzles-core.js`，出题判分纯变换。_Avoid_: 题库（不是题库，是生成器）
- **数学屏流引擎**：`js/math-paradigms.js`，屏流族呈现-点选-反馈。_Avoid_: 数学范式（范式是专注训练营的词）

## 9. 实施修订记录（T9 收尾清点，2026-10-24）

与 §2/§4/§5 的偏差，均已随票合入且全量测试/lint 保持绿：

| 偏差 | 理由 |
| --- | --- |
| 曲线函数名 **mathParamsFor**（非 paramsFor） | focus-levels.js 已占用该全局名（经典 script 共享词法环境，重名静默覆盖） |
| 世界轨拆两宿主：math-world.js（hop·混合宿主不锁指针）+ math-build-world.js（摆与搭·指针锁宿主），经 modes/math.js 的 **MATH_WORLD_RUNNERS** 注册表分发（历史名——已改名 MATH_TRACK_RUNNERS 并迁至驱动器 js/math-track.js，屏流 T5 并入后 29 键，见 math-track-unification-design.md） | T5/T6 并行开发撞名（原设计为单文件装配）；两宿主交互形态本就不同（走子 vs 放置），注册表即分发缝，宿主统一留待后续 |
| 情境挂载落地为 **MATH_CONTEXTS 情境变体**（craft/shop·hop/clock·count/measure），编排生成器在每情境族每带首个轮转位只换 variant（共 12 关） | §5"情境皮肤挂载"的具体化：挂族不独立成族，tier/kind/params 与族曲线同源 |
| 家长日志 log 键升级 **'族:带'**（T9） | 六族×四带矩阵的数据源；无冒号旧键（开发期形状）由 mathPanelMatrix 兼容读取（只入族合计），不做存档迁移 |
| 图纸 = blueprintPixels 纯投影画 canvas | 与 §3"不用引擎相机远拍"一致，补记实现位 |
| T6 顺修 PuzzleCore mkSymmetryPuzzle 的 z 轴 box 宽深错位 | 首个世界消费者发现；测试补"box 罩住解集"断言 |
| T4 补登 math-puzzles-core.js 的 script 标签 | T3 票的范围纪律（只交库文件）留下的缝 |
| 家长面板未做"重置进度"按钮（focus 有） | spec 未要求；需要时 mathSlot.reset 现成可接 |
| 连败 2 次换路：0 星占位推进（结算 moveOn 分支） | spec 外增量；focus 同构的抗卡死设计，保留 |
| 图章奖励达成线（3/7/30 章观感奖励，MATH_STAMP_REWARDS） | spec 字面之外；focus 集章同构的观感回路，保留 |
| 呈现反泄漏：需求侧数字卡（craft/enough·shortage 配方卡不画方块行）+ 两堆十格阵（count/compare 每行 5 格×两行一组、空格可见） | 用户实测发现"对比块的长度就知道够不够"——等宽单行方块条的长度线索直接等于答案；数字是 CPA 的 A 层学习对象（须数库存再比数字），十格阵同区间阵框同形（须逐个点数或按空格一一对应）。布局纯函数 mFrameLayout(n, seed) 配单测 |
| 快照闪没加固：`.m-flash.m-hide` 在 opacity:0 之上补 visibility:hidden | "闪现后必须靠数"的彻底口径：渐隐完成后移出可见性与无障碍树，不留尾 |
| 双视角推理（US24）/最省块数（US20）/移多补少搬动试错（US6）未实现 | **待拍板缺口**（非偏差）：spec 有字面、实现未覆盖，等产品决策后再立票 |
| 昼夜大钟常驻（US30 前半）经 **G1** 落地：今日页/地图页右上常驻小钟面（真实本地时间，每分钟走针）+ 点击 SpeechKit 报时 | US30 后半（认时刻关卡）T7 hop/clock 已交，US30 全量闭合从缺口清单移除；角度/报时纯函数 **mClockAngles/mClockSay** 入 math-paradigms.js 钟部件族（mClockFace 改为消费同一角度函数=单一出处），装配与走针清理（mathClockTimer，mathScreen 统一收口）住 modes/math.js，样式 .m-clockbox 系入 css/math.css |
| **G4 地图扩容 120 + 双视角/最省桥接线**（2026-10-24 用户拍板"这些都要做"+"扩到 120 关"）：MATH_LEVELS 100→120（四带 × 30，MATH_LEVEL_MIX 每带目标次数表 + 均匀交错替代严格六族循环），plan/dualview（US24 世界轨点选：候选建筑 + 立式投影牌，曲线 single→two-step/候选 2→4/视图 1→2）与 mirror/bridge（US20 世界轨放置：两岸地形 + 河面桥线 + bridgeOk 推理档口径——reverse 能过即对/multi-solve 要 ≤par）入册（变体表新增 tune 变体级曲线覆写与 introBand 解锁带字段）；mathFrontier/地图页/文案改按 MATH_LEVELS.length 求值 | 关号语义 25/带→30/带使旧档三表失真：**存档版本位 v=2 一次性清空 stars/challenge/ready**（上线仅一天损失可忽略；stamps 图章与 log 家长日志按日期记账不受影响，原样保留）——迁移幂等由 test 锁死 |
| 图纸「上面」边标记·火把版（2026-10-28 训练营实测六轮拍板）：plan/build 画布中线对称插两支真火把（wwTopEdgeTorches，B_TORCH=48，居中两支·外圈外两行 z0-3，建造区外不可拆）+ 试次开场语音绑定「火把贴着的这条边，就是图纸的上面」 | 2D 图纸行 0=画布北缘原无锚点，孩子绕到对侧照屏摆出旋转 180° 的"看着对"答案；用户拍板标记只进世界不动 HUD 图纸——方块三角三版全废后定火把（一度误用 id14=苔石，「火把 14」系光照级注释），整排压线晃眼后收成居中两支+外移两行不糊边界线，判分口径（gradeBlueprint 逐格相等）不变 |
