# 玩家运动状态意图 seam 设计定稿（player-state seam）

> 架构治理候选 7（玩家运动状态意图 seam）的拍板记录与交付清单。
> 评审入口：2026-10-24 架构评审（improve-codebase-architecture 流程，HTML 报告）卡 7；
> 相关词条：GLOSSARY「玩家状态（PlayerState）」（随票新建）、「怪物库（Mobs）」（白名单判例出处）；
> 判例先例：mobs.js 头注释的可写字段白名单 + 意图 API（候选 7 对齐的体例）；设计文档体例先例
> docs/arena-core-unification-design.md（候选 3）；关联改动：main.js 兜底清场（C4-T2，飞行态复位行的
> 由此票收编进意图入口）；
> 切票 C7-T1（setFly 收口 + 白名单头注释，fdf3a93）已合入，C7-T2 为本收尾票（守门断言 + 本文档 +
> GLOSSARY 新词）。
> 日期：2026-10-25 · 状态：已交付。

## 背景与证据

**六绑定定义**（voxel.js 玩家段，T1 后行号 157-165；评审票面引 143-154 是 T1 前快照）：
`pos`/`vel` 为带 `set()` 的 const 普通对象（成员可写，零 THREE，与 THREE.Vector3 鸭子类型兼容）；
`onGround`/`yaw`/`pitch`/`flyMode` 为顶层 `let`。经典 `<script>` 共享词法环境里顶层绑定全仓可读
也可写——「谁在写玩家状态」在治理前只能靠全仓 grep 回答，无文件级边界。

**写点四类分型**（T1 收口前的全仓证据，行号为当时快照）：

1. **传送/出生**：已全走 ModeKit.spawn（mode-kit.js kitSpawn，L49-57：pos.set + vel.set(0,0,0) +
   yaw/pitch/onGround 复位 + 记住出生点供 onVoidFall 兜底）——意图入口在治理前已事实上存在；
2. **flyMode 裸写族 7 点**（本 seam 的收口对象）：build.js L390（spawn 后复位）/ L470（F 键开关
   `flyMode = !flyMode; vel.y = 0;`）/ L513（cleanup 兜底）、adventure.js L1396（init 复位）、
   nether.js L182 / L194（传送复位）、main.js L151（C4-T2 兜底清场）；
3. **视角热路径**（登记例外）：input.js L73-75（mousemove）与 L163-165（触屏 dragmove）直写
   yaw/pitch——视角唯一属主 + 事件频率高于帧率，setter 包装无正确性收益只多一跳；
4. **结构性例外**（登记）：math-world.js L284-315（走子 pos.set/vel.set）与 L637-639 / L675-677
   （每帧姿态注入直写）——根因：主循环物理门控（main.js L242 `if (locked || touchPlaying)` 才跑
   physics；票面引 L218 为 C4-T2 前行号），不锁指针的纯点选宿主只能自持 rAF 直接驱动玩家，
   文件头 L14-16 已自白；tank.js L528/529/613/626 引擎同侪直写（驾驶锁舱 + 上下车视角对齐，
   引擎层内部，不涉模式层）。

**红线**：combat-kit.js L37 mkFighter 把 `pos, vel` 可变引用别名进战斗实体（nether getPEnt /
adventure advGetPEnt 同形归一）——意图入口只能原地改字段，不得替换绑定，否则两模式的战斗实体
瞬间与真玩家脱钩。test/voxel.test.js L24-29 用 vm getter/setter 垫片暴露 let 绑定——新增函数
不得破坏垫片（setFly 经 __v 桥新增暴露，垫片不动）。

**判例**：mobs.js 头注释 L16-27——「模式可写引擎字段的白名单（逐字段给理由）+ 意图 API
（move/shift/setPos/steer/heal/setMaxHp/remove/settle…）」，且**意图 API 住实体模块自身**
（mobs.js），不住应用层 kit。

**注释漂移**（顺带修正）：input.js 头注释把 yaw/pitch 归属写成「world.js 的」（实际定义在
voxel.js L153，T1 后 L164）。

## 拍板决策

**① B 档起步（收口裸写族 + 白名单登记），不上整块 A 档（全写点强制意图 API）。**

- 写点已高度收敛：flyMode 族 7 点形状单一（复位 / 开关），传送在 T1 前已全走 spawn——新 API
  的边际收益就是 7 行换 7 行，不动量不配 A 档的迁移面；
- 强套意图 API 对热路径 / 自持 rAF 无正确性收益：input.js 每事件直写 yaw/pitch 改经函数只是
  加一层调用；math-world 的根因是引擎缺「非锁定宿主驱动玩家」的入口，在模式层包一层 setter
  是假治理（症状照旧，还多一跳）；
- 登记例外比假治理诚实：例外逐类写进唯一权威（voxel.js 玩家段头注释）并给理由与根因，
  未来票有据可查；白名单之外的裸写则由守门断言拦死（见拍板③）。

**② setFly 放引擎层 voxel.js 玩家段（flyMode 定义旁），不放应用层 mode-kit。**

对齐 mobs 判例「意图 API 住实体模块」：六绑定的实体模块就是 voxel.js 玩家段；mode-kit 是应用层
kit（模式壳的机器房），spawn 住它只因「记住出生点供 onVoidFall 兜底」是应用层关切。setFly 形状
最小：`setFly(v) { flyMode = v; vel.y = 0; }`——vel.y=0 语义照 build.js:470 F 键开关现状（关飞行
瞬间不被残留升/坠速拖着走），复位场景 vel.y 本就近 0（spawn 已 vel.set(0,0,0)），清之无害；只
原地改字段与 let 绑定赋值，不替换绑定（红线②守恒）。

**③ 守门只管 js/modes/\*.js，不扫 js/ 库文件。**

模式文件是玩家状态的**消费方**——零裸写 = 零例外；js/ 库文件的例外在白名单逐类登记（唯一
权威），若再用断言复刻白名单就是两份权威。断言正则三形状：顶层绑定直写（`(?<!\.)\b(yaw|pitch|
onGround|flyMode)\s*(?:\+=|-=|\*=|/=|=)(?!=)`）/ 成员直写（pos/vel 的 .x/.y/.z 赋值）/ 鸭子
set 直调（`pos.set(`/`vel.set(`，传送一律走 ModeKit.spawn）。`(?<!\.)` 排除属性访问——m.yaw /
T.onGround 是怪物/载具字段不是玩家绑定（arena.js `m.yaw +=` 判例，预检时唯一误报源）。正则在
拍板前对全仓 js/ 跑过零误报验证（modes 目录零命中；命中全在白名单登记文件与实体字段）。

**④ ModeKit.spawn 形状不加 fly 选项。**

6 个复位写点直接调 `setFly(false)` 比 `spawn(x, y, z, {fly: false})` 更薄：spawn 管传送（位置 +
姿态 + 出生点记账），飞行态是正交关切；合并进 spawn 会让「只复位飞行不动位置」的未来调用方
无形状可用。

## 升格与 ADR 判断（conventions §1.10 / §1.11）

不触发升格、不写 ADR（口径同候选 3）：「模式零直写玩家状态」经本票从口头约定走完 §1.10 的
「口头约定 → 唯一权威 → 测试断言」全程——唯一权威（voxel.js 玩家段头注释）与断言
（conventions.test.js）分工明确：权威管例外登记与理由，断言管消费方零违规；决策全部可逆
（setFly 调用点改回裸写即回滚——守门会红，那是断言在工作，不是不可逆）。本文件即 §1.11
文档三段式的 -design.md 段；GLOSSARY 收词走 §1.8 判据（本票新建词条）。

## 交付清单

- **C7-T1**（fdf3a93）：voxel.js setFly 意图入口 + 玩家段可写白名单头注释（mobs 判例对齐，逐类
  给理由）+ 7 写点切换（build.js 3 处 / adventure.js 1 处 / nether.js 2 处 / main.js 兜底 1 处，
  全部 `setFly(...)`，F 键开关改 `setFly(!flyMode)`——读旧值定新态，读不是写）+ input.js 头注释
  归属修正（world.js → voxel.js）+ test/voxel.test.js setFly 用例（置位 + 清垂直速度）。
  票外必要补丁：adventure-mode / nether-mode 测试 harness 各补 setFly 镜像桩（两 harness 自铺
  玩家状态桩不加载真 voxel.js，桩口径「行为与真库一致」）。测试 964 → **965**。
- **C7-T2**（本票）：test/conventions.test.js 守门断言（模式文件零直写玩家六绑定，三形状正则 +
  扫描范围 ≥7 文件防静默失效 + 失败信息带文件:行号与命中文本）+ 本文档 + GLOSSARY 新词
  「玩家状态（PlayerState）」。测试 965 → **966**。

## 行为面影响登记（诚实口径）

**恒等**：setFly 语义 = 原裸写序列逐点等价——6 个复位点原为 `flyMode = false;`（setFly 多清一次
vel.y，但复位场景 vel.y 本就近 0，且 5 处复位点紧跟 ModeKit.spawn 之后，spawn 已 vel.set(0,0,0)，
零差）；F 键开关点原为 `flyMode = !flyMode; vel.y = 0;` 与 `setFly(!flyMode)` 逐字等价。守门断言
与文档是纯文本面，无运行时行为。

## 测试与守门

- **新增守门**：test/conventions.test.js「模式文件零直写玩家六绑定」——三形状正则（顶层绑定
  直写 / 成员直写 / 鸭子 set 直调），失败信息给文件:行号 + 命中文本 + 意图入口指路；`(?<!\.)`
  排除属性访问（arena.js m.yaw 怪物字段判例）；扫描范围断言 js/modes ≥7 个文件（防扫描空集 =
  守门静默失效）。
- **正则预检**：对全仓 js/ 逐行跑，modes 目录零命中；命中全在白名单登记文件（voxel/input/
  math-world/tank/mode-kit）与非玩家实体字段（mobs/mob-core/tank-core 的 m.\*/T.\*）。
- **牙口负向验证**：在 modes 文件临时塞 `flyMode = false;` → 守门红（断言信息含文件:行号），
  还原后全绿——结果登记在 C7-T2 提交正文。
- **既有安全网**：voxel 单测（setFly 用例）/ boot 全链冒烟 / 两模式 harness 镜像桩全绿；ESLint /
  Stylelint / htmlhint 三 lint 零错。

## 遗留与后续钩子

- **math-world 根因登记**：main.js L242 `if (locked || touchPlaying)` 物理门控——不锁指针宿主
  （纯点选模式）只能自持 rAF 直写玩家状态。「非锁定宿主驱动玩家」的引擎入口缺位，治理归未来
  引擎票（候选方向：宿主驱动接口 / 驱动回调注入，由引擎层收口到点驱动）；该票落地时
  math-world 的白名单例外应随之消解，白名单是活文档。
- **A 档完整形未做**（spawnAt 吸收 pitch/onGround 等姿态注入的完整意图 API）：消费方只有
  math-world 一家且已登记例外——等引擎「非锁定宿主驱动入口」票一并治理才是根治，单独做
  只是搬家。
- **input.js 热路径**：永久例外（视角唯一属主 + 事件频率高于帧率）；除非未来出现第二视角写者
  才重评。
- **守门范围**：目前不扫 js/ 库文件（拍板③口径）；若库文件出现白名单外新写点，依 §1.10 评估
  扩扫或先登记理由。
