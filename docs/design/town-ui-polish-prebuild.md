# 城镇 UI 走查清单与 U/B/N/P 参数总表预备（T-UI-05 预备稿）

> 文档状态：**预排版（polish 票预备稿；T-UI-05 最早可开工条件未满足——T-UI-01..04 均未实现、T-MAP 链未解阻——本文件先落「参数总表骨架 + 可达性走查清单预备」；票面的联调/微调落地/文案 TTS 终检/三门全量**明确挂起**，见 §3）**
> 产出日期：2026-11-13
> 角色：ui-designer（T-UI-05 预备单，A+B）
> 范围：**纯设计文档**（不改 `js/`、`test/`、`index.html`、`css/`；联调期微调与实现归解阻后的本票执行段）
> 设计权威（不得推翻）：[`town-ui-entry-hud-spec.md`](town-ui-entry-hud-spec.md) **§8（U1-U8）**、[`town-ui-dialog-spec.md`](town-ui-dialog-spec.md) **§10（B1-B8）**；默认值与落点并表来源：[`town-ui-entry-tokens.md`](town-ui-entry-tokens.md)（U1-U3）、[`town-ui-hud-prebuild.md`](town-ui-hud-prebuild.md)（U4-U8 + P 系列）、[`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md)（B1-B8 + N1-N5）
> 体验门槛：[`../town-architecture-design.md`](../town-architecture-design.md) **§7.2（纯鼠标/热区/无倒计时约束）、§12.5（验收门槛）**；[`../town-assets-requirements.md`](../town-assets-requirements.md) **§7（UI-01~05 资产语义终检面）**
> 使命约束：[`../../MISSION.md`](../../MISSION.md)（6 岁、纯鼠标点选、图标+中文 TTS、过程性表扬、零惩罚、零倒计时）

---

## 0. 对齐与边界说明

- **本文件性质**：T-UI-05（UI 联调、可达性走查与文案/TTS 默认值落地，polish 票）的**预备稿**——两件预备物：① U/B/N/P 参数总表骨架（§1，并表四份来源已落默认值）；② 可达性走查清单骨架（§2，逐项给检查方法+证据要求+状态=挂起）。票面交付物中的**执行性内容**（走查逐项打勾、联调微调最小 diff、文案/TTS 统一出口终检、三门全量）**全部挂起**至最早可开工条件满足（§3）。
- **默认值口径**：一律照三份 prebuild（entry-tokens / hud-prebuild / dialog-prebuild）已落值并表，**本票不新拍任何默认值**；发现 prebuild 间矛盾只列歧义（§4）不擅裁，上抬 PO/需求线。
- **引用勘误（按文件现状引用）**：票面 ui_refs 写「dialog-spec 全文 §8（B1-B8）」为指针漂移——B1-B8 实际在 **§10**（§8 是「典型内容模板」）；U1-U8 在 entry-hud-spec **§8** 属实。本文件按现状引用（与 `town-ui-dialog-prebuild.md` §9 勘误登记一致）。
- **CS 前缀登记**：§1.7 三行 CS-1/CS-2a/CS-2b 为 analyst-manager 跨分区审核经本派单转登的裁决项，非本票新增设计。

---

## 1. U/B/N/P 参数总表骨架（本单核心）

### 1.1 总表口径

- **并表范围**：U1-U8（spec §8 原项；细化落点来自 entry-tokens §4（U1-U3）与 hud-prebuild §6.1（U4-U8））+ B1-B8（dialog-spec §10 原项，dialog-prebuild §6 落定）+ N1-N5（dialog-prebuild §8 本票新增登记）+ P 七项（hud-prebuild §6.2/§6.3 本票新增登记）。
- **「PO 一处改动」入口**：PO 若要改默认值，只需改该列指向的**单一参数位/字符串值**，不动结构、不返工布局——即各 prebuild「参数化落点」的收口表述。
- **状态口径**：`默认已落 · 待 PO 核` = 默认值已照权威/prebuild 落定、可直接排期，PO 最终验收批次逐项确认后仅改参数不改结构。CS 行状态另计（待 PO 裁决）。
- **表尾注**：联调阶段（T-UI-05 执行段）在每表**增「实测值/微调记录」列**，本骨架不预占空列。

### 1.2 U1-U3（入口卡与进出过渡；spec §8 → entry-tokens 落定）

| 编号 | 参数 | 默认值（已落） | 来源（文档与章节） | 实现落点 | PO 一处改动入口 | 状态 |
|---|---|---|---|---|---|---|
| U1 | 模式卡标题/副标题与 TTS 读法 | 标题**「小镇漫步」**；副标题**「逛广场 · 找朋友 · 轻松玩」**；TTS 建议"逛广场，找朋友，轻松玩" | [`town-ui-entry-hud-spec.md`](town-ui-entry-hud-spec.md) §8；[`town-ui-entry-tokens.md`](town-ui-entry-tokens.md) §1.4/§4 | `index.html` 卡片 `h2`/`small` 文案；TTS 朗读字符串；`js/mode-registry.js` `name` 展示名（若与标题统一） | 文案字符串值（三处同步改一次） | 默认已落 · 待 PO 核 |
| U2 | 入口卡主图标 | 首版 emoji **🏘️**；后续替换专属城镇/钟塔像素图标（UI-01 风格，16×16/32×32） | 同上 §8；[`town-ui-entry-tokens.md`](town-ui-entry-tokens.md) §1.3/§4 | `.big` 内容（emoji 文本或 `<img>` 资产）；过渡中央占位图标资源 | `.big` 内容源（emoji ↔ 资产路径） | 默认已落 · 待 PO 核 |
| U3 | 进入城镇是否二次确认 | **不需要**，点卡直接过渡进入（可选分支仍须单键「出发去小镇」+「返回」、无风险提示） | 同上 §8；[`town-ui-entry-tokens.md`](town-ui-entry-tokens.md) §2.1/§4 | 进入流程分支开关（直接进 vs 确认页） | 流程分支开关（含可选分支文案） | 默认已落 · 待 PO 核 |

### 1.3 U4-U8（HUD/指引/反馈；spec §8 → hud-prebuild 落定）

| 编号 | 参数 | 默认值（已落） | 来源（文档与章节） | 实现落点 | PO 一处改动入口 | 状态 |
|---|---|---|---|---|---|---|
| U4 | 小地图/指引形态 | **Landmark Pointer**（圆形徽章+4 方位扇形指针+3 档定性距离）；首版**不做**详细小地图 | [`town-ui-entry-hud-spec.md`](town-ui-entry-hud-spec.md) §8；[`town-ui-hud-prebuild.md`](town-ui-hud-prebuild.md) §3.1/§6.1 | L2 渲染模式开关（首版唯一值 `landmark-pointer`）；`js/town-ui-core.js` `townPointerTarget` | L2 渲染模式参数（单枚举值） | 默认已落 · 待 PO 核 |
| U5 | 方位指引默认可见策略 | 有活动目标=常显；无目标=**钟塔弱提示**（50% 透明、保留回家指向）；会话中=暂隐 | 同上 §8；[`town-ui-hud-prebuild.md`](town-ui-hud-prebuild.md) §3.3/§6.1 | `townPointerTarget` 回落策略参数（`'belltower-fallback'` \| `'hidden'`） | 回落策略参数（单枚举值） | 默认已落 · 待 PO 核 |
| U6 | 任务提示手动收起/重播 TTS | **支持重播**（L1 右端小喇叭钮，首版 emoji 🔊 占位）；收起为可选（默认自动随任务状态切换，无手动收起钮；收起无负面后果） | 同上 §8；[`town-ui-hud-prebuild.md`](town-ui-hud-prebuild.md) §2.4/§6.1 | L1 按钮组配置（`replay: true` / `manualDismiss: false`） | L1 按钮组配置布尔值 | 默认已落 · 待 PO 核 |
| U7 | 表扬反馈强度与频率上限 | 单次 **1.2-2.0s**、同屏 **1 条**、事件触发不连续刷屏；队列策略见 P-S1 | 同上 §8；[`town-ui-hud-prebuild.md`](town-ui-hud-prebuild.md) §2.1/§6.1 | L3 容器节奏参数 + 队列裁决（core `TOWN_UI_PARAMS.PRAISE_MS`） | L3 节奏参数区间值 | 默认已落 · 待 PO 核 |
| U8 | 分区 B 产出时间与评审顺序 | **流程项，非视觉参数**（B 定稿与 B 预排均已在库，接口已按 dialog-spec §2 对齐） | 同上 §8；[`town-ui-hud-prebuild.md`](town-ui-hud-prebuild.md) §6.1 | 无实现落点；联调节奏归 T-UI-04/需求线 | 无（流程项） | 流程项 · 已对齐 |

### 1.4 B1-B8（会话 UI；dialog-spec §10 → dialog-prebuild 落定）

| 编号 | 参数 | 默认值（已落） | 来源（文档与章节） | 实现落点 | PO 一处改动入口 | 状态 |
|---|---|---|---|---|---|---|
| B1 | Session Panel 锚位 | **底部居中**（上半屏 ≥55% 世界可见；与小地图/任务条避让） | [`town-ui-dialog-spec.md`](town-ui-dialog-spec.md) §10；[`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md) §1.4/§6 | `--town-dlg-panel-w/bottom` token + 装配布局 | `panel.anchor` 参数（单枚举值） | 默认已落 · 待 PO 核 |
| B2 | 同屏背景 NPC 闲聊 bubble | **默认关闭**（首版仅当前会话相关 bubble） | 同上 §10；[`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md) §1.3/§6 | `js/town-dialog-core.js` `DIALOG_OPTS.ambientBubbles` 常量 | `ambientBubbles` 布尔值 | 默认已落 · 待 PO 核 |
| B3 | 选项上限与二级选择 | **每步 ≤3、无二级嵌套**（复杂任务拆步） | 同上 §10；[`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md) §1.5/§6 | `DIALOG_OPTS.maxOptionsPerStep=3` / `allowNestedChoice=false` + Panel 渲染守卫 | `maxOptionsPerStep` 数值 + 嵌套布尔 | 默认已落 · 待 PO 核 |
| B4 | TTS 自动播报策略 | **每步自动一次 +「再听一次」**；遵循系统静音 | 同上 §10；[`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md) §4.2/§6 | `tts.autoPerStep='once'` / `tts.respectMute=true`（SpeechKit 接线） | TTS 参数面两值（§4.2 表） | 默认已落 · 待 PO 核 |
| B5 | 会话关闭文案/图标语义 | **「稍后」/挥手再见**图标（首版 emoji 👋 占位）；不出现「退出任务」压力词 | 同上 §10；[`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md) §1.5/§6 | `close.affordance` 文案表 + chip 图标位 | `close.affordance` 文案/图标值 | 默认已落 · 待 PO 核 |
| B6 | Seek 目标缩略图 | **常驻**（Seek 态 Speaker Strip 旁目标小图标） | 同上 §10；[`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md) §1.4/§6 | Panel Strip 槽位（UI-05/UI-01 图标） | `seek.targetThumb` 参数（persistent \| off） | 默认已落 · 待 PO 核 |
| B7 | 铁傀儡关怀首版范围 | **纳入轻交互（问候/感谢）**；裂纹修复未实现则仅氛围、不暴露「受伤数值」 | 同上 §10；[`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md) §6 | `sessionKind 'care'` 路由 + `--town-dlg-guard` 身份条 | `golem.careSession` 参数（light \| off） | 默认已落 · 待 PO 核 |
| B8 | 会话内完成反馈与 A 任务反馈视觉 | **语义同源、构件复用（UI-04）**；尺寸/停留会话内更紧凑（停留取 1.2s 下限档） | 同上 §10；[`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md) §4.1/§6 | UI-04 资产 + 节奏参数 | `praise.sessionCompact` 布尔值 | 默认已落 · 待 PO 核 |

### 1.5 N1-N5（T-UI-04 预排新增登记；dialog-prebuild §8）

| 编号 | 参数 | 默认建议（已落） | 来源（文档与章节） | 实现落点 | PO 一处改动入口 | 状态 |
|---|---|---|---|---|---|---|
| N1 | `close result` 三值语义 | deferred=稍后（零负面）/ done=完成自然结束 / continue=继续看看或轻问候收尾 | [`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md) §2.3/§8 | core 事件 payload + A 侧行为（hud-prebuild §2.5） | result 语义表（core 常量） | 默认已落 · 待 PO 核 |
| N2 | Seek 期间 Panel 常驻 vs 收起 | **常驻+半透明**（走动实测遮挡再议收起） | 同上 §2.4/§8 | Panel 生命周期（会话状态机） | Panel 生命周期开关 | 默认已落 · 待 PO 核 |
| N3 | praise 后步进时机 | **dwell 自动步进 + 可提前点选**（`praise.autoAdvance=true`，6 岁零阅读负担优先） | 同上 §2.2/§8 | core 参数 `praise.autoAdvance` | `autoAdvance` 布尔值 | 默认已落 · 待 PO 核 |
| N4 | `sessionKind` 枚举 | `'greet' \| 'tour' \| 'seek' \| 'help' \| 'care'`（与 T-MAP-04 协议对齐后定稿） | 同上 §2.4/§8 | T-MAP-04 协议对齐 + core 路由 | 枚举常量表（协议对齐后） | 默认已落 · 待 PO 核（随 T-MAP-04） |
| N5 | 挥手/喇叭 emoji 占位 | 👋（B5 关闭+greet 选项）/ 🔊（A+B 重播钮共用同图） | 同上 §7.2/§8 | chip 图标位 + 重播钮图标源 | 占位 emoji 字符（后续换像素图标） | 默认已落 · 待 PO 核 |

### 1.6 P 七项（T-UI-01..03 预排新增登记；hud-prebuild §6.2/§6.3）

| 编号 | 参数 | 默认值（已落） | 来源（文档与章节） | 实现落点 | PO 一处改动入口 | 状态 |
|---|---|---|---|---|---|---|
| P-V1 | L1 无任务态 | 「探索中」轻状态（小图标+「随便逛逛」弱化 50%）；可切完全隐藏 | [`town-ui-hud-prebuild.md`](town-ui-hud-prebuild.md) §6.2 | `townHudCardState` 初始转移配置 | 轻状态/全隐藏开关 | 默认已落 · 待 PO 核 |
| P-H1 | 会话中 L1 处理 | **暂隐**（可切弱化 40-50%） | 同上 §6.2 | `townHudDimming`（core 函数 2） | dim/hidden 档位参数 | 默认已落 · 待 PO 核 |
| P-H2 | 会话中 L2 处理 | **暂隐**（可切弱化为仅图标）；与 CS-1（§1.7）关联 | 同上 §6.2 | `townHudDimming`（core 函数 2） | dim/hidden 档位参数 | 默认已落 · 待 PO 核（CS-1） |
| P-S1 | L3 表扬队列策略 | 当前播完后显下一条；等待队列深 1；新事件顶替等待项 | 同上 §6.2 | core 函数 1 副作用意图 + 装配层队列 | 队列深度/顶替策略参数 | 默认已落 · 待 PO 核 |
| P-D1 | 「就在附近」阈值 | ≤12 格且目标在视野角内（指针淡出、图标柔光呼吸） | 同上 §3.3/§6.3 | `townPointerBand` `bands` 注入位 | `bands.nearby` 数值 | 默认已落 · 待 PO 核 |
| P-D2 | 「近/远」分界 | 40 格（近=双环；远=单细环） | 同上 §3.3/§6.3 | 同上 | `bands.far` 数值 | 默认已落 · 待 PO 核 |
| P-A1 | 方位档粒度 | 4 方位离散（前/左/右/后，每 90° 档；「后」弱化 10%） | 同上 §3.1/§6.3 | `townPointerHeading` 输出域 | 档粒度常量（输出域） | 默认已落 · 待 PO 核 |

### 1.7 CS 跨分区审核登记（analyst-manager 经本派单转登；非本票新增设计）

| 编号 | 裁决项 | 分歧/数据点 | 处理口径（不阻塞施工） | 状态 |
|---|---|---|---|---|
| CS-1 | 会话中 L2 指引处置 | A 稿默认 **P-H2=暂隐**（[`town-ui-hud-prebuild.md`](town-ui-hud-prebuild.md) §6.2）vs B 稿 §3.1 建议 **Seek 有目标时保留指向**（[`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md) §3.1，注明策略归 T-UI-02） | 策略 owner=A/T-UI-02；实现按 P-H2 暂隐默认落；**Seek 会话期间是否例外保留指向归 PO 裁决**，核准则仅改 `townHudDimming` 一处档位 | 待 PO 裁决（不阻塞） |
| CS-2a | 高亮金双色统一 | 权威值 `#FFD89A`（[`town-ui-entry-hud-spec.md`](town-ui-entry-hud-spec.md) §6.2 悬停高亮/CSS 侧）vs 资产值 `#F6C96B`（UI 资产登记「UI 高亮金」）；**第三数据点**：B 稿已做语义分工（[`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md) §1.2——`--town-dlg-hl #F6C96B` 柔光描边 + `--town-dlg-hl-warm #FFD89A@0.55` 边中段细线） | CSS 侧按权威 `#FFD89A`、SVG 资产内部维持 `#F6C96B`（hud-prebuild §9 A-02）；PO 三选一：统一单值 / 采纳 B 稿语义分工 / 维持并存 | 待 PO 裁决（不阻塞） |
| CS-2b | 完成绿双档 | 权威值 `#7FB069`（hud-spec §6.2 草绿/CSS 侧）vs 资产值 `#9BCF7A`（资产内麦绿勾，B 侧 `--town-dlg-done` 亦取此值） | 同 CS-2a 处理：CSS 按权威、资产维持现状（hud-prebuild §9 A-03）；PO 统一或明确分工 | 待 PO 裁决（不阻塞） |

> **表尾注（全表适用）**：以上并表值为三份 prebuild 已落默认，本票未新拍任何值；联调阶段（T-UI-05 执行段）各表增「**实测值/微调记录**」列（走查实测 + 最小 diff 记录回填），届时本表即 PO 验收批次的核对底稿。

---

## 2. 可达性走查清单骨架（挂起等实现）

> 口径：本节为**骨架预备**——每项已给「检查方法 + 证据要求 + 当前状态」，逐项打勾与证据留待 T-UI-05 执行段（触发条件见 §3）。体验门槛引用 [`../town-architecture-design.md`](../town-architecture-design.md) §12.5（纯鼠标可完成主路径「进入→识别地标→获得提示→点选交互/对话」）与 §7.2（热区 ≥44px 等效、无倒计时/失败态/警示红）。

### 2.1 主路径纯鼠标可达（§12.5 门槛逐段）

| # | 检查点（主路径分段） | 检查方法 | 证据要求 | 状态 |
|---|---|---|---|---|
| 1 | **进入**：主菜单点城镇卡 → 加载过渡 → 落点城镇（全程无键盘/无二次弹窗，U3 默认） | 仅用鼠标从主菜单走到城镇内落点；核对落点面向广场/可回望钟塔方位 | 步骤录屏或连续截图（含入口卡 hover/active 态）；无任何键盘输入记录 | 挂起 |
| 2 | **识别地标**：落点后钟塔/广场一眼可辨（世界侧）+ L2 指引器可见（有目标常显/无目标钟塔弱提示，U4/U5） | 进图静止 3s 观察世界与 L2；切换有无目标两种态 | 截图（L2 三态：目标/钟塔弱提示/会话暂隐）；L2 位置=上中、不与 L4 重叠 | 挂起 |
| 3 | **获得提示**：L1 提示卡出现 + TTS 自动播报一次（含重播钮可用，U6） | 触发一条主目标 focus；点 L1 右端重播钮核对完整句重播一次 | 截图（L1 四件套：主图标/数量暗示/短标签/重播钮）；TTS 播报记录（或静音态下界面仍可读的证据） | 挂起 |
| 4 | **点选交互/对话**：世界对象 hover 高亮 → 点选 NPC → bubble → Panel 开（greet）全程纯鼠标 | 对任一 NPC 完整走 hover→pointerdown→pointerup→bubble→Panel 链路；核对 300ms 内可感知反馈 | 录屏一段（含 hover 高亮态与 Panel 打开动画）；无键盘/拖拽/长按依赖 | 挂起 |
| 5 | **无压力返回**：L4 系统钮/Panel「稍后」随时可退，退出零负面反馈（P-H 系/B5） | 会话中点「稍后」→ Panel 关、HUD 恢复、无惩罚提示；城镇内点 L4 返回主菜单 | 前后态对比截图；确认无「确定要离开吗」类二次打断 | 挂起 |

### 2.2 热区 ≥44px 抽查点清单（全部可点元素枚举）

| # | 可点元素 | 规格值（来源） | 检查方法 | 证据要求 | 状态 |
|---|---|---|---|---|---|
| 1 | L1 TTS 重播钮 | ≥44×44 CSS px 等效（图标 20-24px + padding 补足；hud-prebuild §2.4） | DevTools 量取热区盒模型 | 截图含尺寸标注 | 挂起 |
| 2 | L4 系统钮（返回主菜单） | ≥44×44（hud-prebuild §1.3 `--town-hit-min: 44px`） | 同上 | 同上 | 挂起 |
| 3 | Option Chip（主选项） | 触点 64×64、热区 ≥56×56（dialog-prebuild §1.2 `--town-dlg-chip-size/-chip-hot`） | DevTools 量取每档选项 | 截图含尺寸标注（1-3 选项布局均验） | 挂起 |
| 4 | Action Ghost「稍后」/「再听一次」 | 文字按钮高 ≥44px（dialog-prebuild §1.2 `--town-dlg-ghost-h`；§1.5） | 同上 | 同上 | 挂起 |
| 5 | 世界可交互对象投影热区 | ≥44×44 CSS px 等效（或世界投影后屏幕等效尺寸充足；相邻热点留间距防误点；按相机距离校准——hud-prebuild §4.4） | 典型距离档（远/中/近）各抽 2 个对象量投影热区 | 各档截图+等效尺寸记录 | 挂起 |
| 6 | 入口卡（主菜单） | 热区 ≥ 卡片可视面（entry-tokens §1.1；触控余量） | DevTools 量卡片热区盒 | 截图含尺寸标注 | 挂起 |
| 7 | 相邻热点间距（防误触） | chip 间距 ≥16px / 一般 ≥12px（dialog-prebuild §1.6） | 量 Option Chip 相邻间距与其他相邻可点元素间距 | 截图含尺寸标注 | 挂起 |

> L2 指引器首版**非交互**（hud-prebuild §3.1），不适用热区口径，不在抽查列。

### 2.3 对比度抽查点（主要文字色/底色对）

| # | 色对（文字 on 底） | 用途 | 来源（token 表） | 静态预估* | 检查方法 | 状态 |
|---|---|---|---|---|---|---|
| 1 | `#5A4636` on `#F4D9A6` | L1 短标签/主文 on 奶油底；B 侧 Panel 主文（`--town-hud-ink/-base`、`--town-dlg-text/-panel-bg`） | hud-prebuild §1.2；dialog-prebuild §1.2 | **6.48:1** | 实测：DevTools 对实际渲染元素取色（半透明底按合成后取色）→ 任意对比度计算工具（如 WebAIM Contrast Checker）核值 | 挂起 |
| 2 | `#6B4E3D` on `#F4D9A6` | B 侧辅助文字（`--town-dlg-text-sub` on Panel 主底） | dialog-prebuild §1.2 | **5.51:1** | 同上 | 挂起 |
| 3 | `#5A4636` on `#D7D2C8` | 主文 on Stone Light 备选底/Panel 分区条 | dialog-prebuild §1.2 | **5.90:1** | 同上 | 挂起 |
| 4 | 同对 1（chip 标签 12-14px 小文本口径） | Option Chip 1-3 字标签（小文本，不享大文本放宽） | dialog-prebuild §1.2 | 同对 1 | 同上，按小文本阈值核 | 挂起 |

- **工具与阈值口径**（以既有规范为准，不新造标准）：阈值引用 **WCAG 2.x AA**——普通文本 ≥4.5:1、大文本（≥18px 加粗/≥24px 常规）≥3:1；本 UI 主文/短标签 ≥18px 加粗属大文本口径**3:1 起评**，但上表静态预估均 >4.5:1（更严口径也过）。工具不指定单一产品：浏览器 DevTools 取色 + 任一对比度计算器即可，**以实际渲染取色为准**（半透明 `0.90-0.96` 底叠加世界画面后取合成色）。
- *静态预估 = 本票按 WCAG 相对亮度公式对 token 原值预计算（联调用实测值覆盖）；入口卡标题/副标题文字对比**沿用既有 `.mode-card` 基线**（不在三份 prebuild token 表内，不新检，联调时可顺手记录基线值）。
- 色弱友好「色+形」双通道（hud-prebuild §4.2）与轮廓色禁用樱花粉/浅石作唯一轮廓色——随第 2.1-4 步点选走查顺带目检，不单列。

### 2.4 无压力文案检查项（禁词清单）

| # | 检查点 | 检查方法 | 证据要求 | 状态 |
|---|---|---|---|---|
| 1 | 禁词清单过筛（UI 显示文案）：**失败 / 错误 / 再试一次（惩罚性）/ 退出任务 / 放弃 / 倒计时 / 读秒 / 超时 / 进度百分比 / 确定要离开吗 / 红叉图形 / 警示红常态** | 汇总全部 UI 文案字符串（入口卡/L1-L4/Bubble/Panel/选项/过场）逐条对照禁词表 | 文案清单表（含出处）+ 过筛记录 | 挂起 |
| 2 | 禁词清单过筛（TTS 朗读串）：同上禁词 + 无催促语/无比较语/无天赋标签（夸过程不夸聪明） | 汇总全部 TTS 字符串对照 MISSION 反馈哲学与 dialog-spec §7.1 | TTS 文案清单 + 过筛记录 | 挂起 |
| 3 | 关闭/退出语义零负面：所有出口=「稍后/再见/继续看看」正向词（B5）；离开零代价无二次打断（dialog-spec §6.2） | 逐出口走查实际文案与行为 | 出口清单+截图 | 挂起 |
| 4 | 硬约束零倒计时/无失败态复核：L1-L4 组件与状态机无时间敏感元素、无 fail 态（hud-prebuild §2.2 落实表） | 组件面检查 + core 单测断言（实现票已含，走查复核跑测记录） | `npm test` 相关断言绿记录 | 挂起 |

> 依据：MISSION（零惩罚、零倒计时压迫）、dialog-spec §6.3（禁止项）、hud-prebuild §2.2（硬约束落实表）、entry-tokens §2.3（入口禁止项清单）。

### 2.5 过程性表扬节奏检查项（U7 / P-S1 / N3 口径）

| # | 检查点 | 检查方法 | 证据要求 | 状态 |
|---|---|---|---|---|
| 1 | L3 全局表扬：单次停留 **1.2-2.0s**、同屏 **1 条**、事件触发不连续刷屏（U7） | 连续触发 2+ 个完成事件，观察队列行为（P-S1：播完再显、等待深 1、新事件顶替等待项） | 录屏（含连续事件场景）；时序记录 | 挂起 |
| 2 | 会话内 Praise Toast：弹入 180ms、停留 ≥800ms、总时长 1.2-2.0s、**不阻塞**继续/关闭（B8 会话内更紧凑=停留取 1.2s 下限档） | 会话中完成一步，量各段时长并尝试表扬期间点选 | 录屏+时长标注 | 挂起 |
| 3 | N3 dwell 步进：praise 后自动步进（可提前点选） | 表扬态等待自动步进；再验提前点选生效 | 录屏两段 | 挂起 |
| 4 | respond 即时确认：动作被接收后 **300ms 内可感知**（chip 高亮回弹/星闪） | 点选选项后计时目检 | 录屏（帧级时戳） | 挂起 |
| 5 | 徽章累积：会话内 1-3 枚封顶、只增不减、不倒扣不清零（dialog-prebuild §4.1） | 多步会话走查徽章位 | 截图序列 | 挂起 |
| 6 | 会话中 L3 冻结（不与 B 侧 panel 内表扬叠加）；close 后错峰补位（hud-prebuild §2.5/§3.1 分工） | 会话中触发全局完成事件观察 L3 冻结；close(done) 后观察错峰 | 录屏 | 挂起 |

---

## 3. 联调挂起节（触发条件与届时底稿用法）

### 3.1 挂起项清单（票面执行性内容，全部挂起）

| 挂起项 | 票面出处 | 届时底稿 |
|---|---|---|
| 走查清单逐项打勾+证据（截图/步骤） | 交付物 1 | 本文件 §2（状态列从「挂起」翻「通过/待修」，证据回填） |
| 参数表联调核对（U/B/N/P 并表对实现实测） | 交付物 2 | 本文件 §1（增「实测值/微调记录」列） |
| 文案/TTS 默认值落地与**统一出口排队终检**（SpeechKit 统一出口、dialog-prebuild §4.2 仲裁参数面：优先级表 + `tts.preempt/queueMax/suppressAInSession/autoPerStep/debounceSameMs/respectMute`） | 交付物 3 | dialog-prebuild §4.2 参数表 + 本文件 §2.4 禁词过筛 |
| UI 资产语义终检（UI-01~05 语义×实现 UI 树逐项对齐，[`../town-assets-requirements.md`](../town-assets-requirements.md) §7） | 设计权威参照 | 两份 prebuild §7 资产占位清单 |
| 微调项最小 diff 落地并过三门；结构性问题列票走需求线不扩本票 | 交付物 4 | 最小 diff 原则（票面「并行冲突规避」） |

### 3.2 触发条件（最早可开工）

- **T-UI-01..04 四票实现收口**（A/B 两分区实现闭环可联调）；
- **T-MAP 链解阻**（T-MAP-02 入口接线 / T-MAP-03 场景与锚点 / T-MAP-04 目标 id 协议——hud-prebuild §2.6 与 dialog-prebuild §2.4 的 seam 歧义随 T-MAP-04 定稿销号）。

两项均满足前，本文件仅为预备稿；届时 T-UI-05 执行段以本文件为走查底稿，不另起炉灶。

---

## 4. 歧义 / 待需求线裁决

| # | 歧义/裁决项 | 归口 | 本票处理 |
|---|---|---|---|
| 1 | 指针漂移勘误（登记）：票面 ui_refs「dialog-spec 全文 §8（B1-B8）」→ 实际 **§10**（§8 是内容模板）；「entry-hud-spec 全文 §8（U1-U8）」属实 | 票面勘误，不改文档 | 本文件按现状引用（§0） |
| 2 | CS-1 会话中 L2 处置（A 稿 P-H2 暂隐 vs B 稿 Seek 保留指向） | PO（策略 owner=A/T-UI-02） | §1.7 登记，不阻塞 |
| 3 | CS-2a 高亮金双色（`#FFD89A` vs `#F6C96B`，B 稿语义分工=第三数据点） | PO | §1.7 登记（=hud-prebuild §9 A-02） |
| 4 | CS-2b 完成绿双档（`#7FB069` vs `#9BCF7A`） | PO | §1.7 登记（=hud-prebuild §9 A-03） |
| 5 | T-MAP-04 协议未决项（事件载体/id 命名空间/NPC 动态锚点/taskRef 关联等） | 需求线 → T-MAP-04 派单 | 非本票歧义，仅指针：hud-prebuild §9 A-01、dialog-prebuild §9.6-9.9 |

> 三份 prebuild 间**未发现新增矛盾**（U/B/N/P 默认值并表无冲突；CS 三项为已知登记项的跨稿张力收口）。

---

## 5. 引用

- [`town-ui-entry-hud-spec.md`](town-ui-entry-hud-spec.md)（§8 U1-U8——设计权威）
- [`town-ui-dialog-spec.md`](town-ui-dialog-spec.md)（§10 B1-B8、§6.2/§6.3 无压力关闭与禁止项——设计权威）
- [`town-ui-entry-tokens.md`](town-ui-entry-tokens.md)（U1-U3 默认值与落点）
- [`town-ui-hud-prebuild.md`](town-ui-hud-prebuild.md)（U4-U8 + P 七项默认值与落点；§9 歧义 A-01..A-06）
- [`town-ui-dialog-prebuild.md`](town-ui-dialog-prebuild.md)（B1-B8 + N1-N5 默认值与落点；§4.2 TTS 仲裁参数面；§9 歧义登记）
- [`../town-architecture-design.md`](../town-architecture-design.md)（§7.2 约束、§11 票据、§12.5 验收门槛）
- [`../town-assets-requirements.md`](../town-assets-requirements.md)（§7 UI-01~05 资产语义终检面）
- [`../../MISSION.md`](../../MISSION.md)（过程性表扬/零惩罚/零倒计时/纯鼠标）
- 票面：`.scratch/handoffs/2026-11-13-T-UI-05-dispatch-brief.md`（纯文本引用）

---

**文档结束**
