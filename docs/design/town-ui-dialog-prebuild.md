# 城镇会话 UI 预排细化（T-UI-04：会话三件套 / 状态机×接口闭环 / 纯逻辑函数面）

> 文档状态：**UI 预排定稿（分区 B 会话 UI + A/B 交界；供 T-UI-04 解阻后实现票直接引用）**
> 产出日期：2026-11-13
> 角色：ui-designer（T-UI-04 预排单：规格细化 + token/参数面 + 资产占位清单预备）
> 范围：**纯设计文档**（不改 `js/`、`test/`、`index.html`、`css/`；实现线照票施工）
> 设计权威（不得推翻）：[`town-ui-dialog-spec.md`](town-ui-dialog-spec.md) **§2（A/B 边界与接口）、§4（视觉）、§5（会话分层与状态机）、§6（选项与无压力关闭）、§7（会话内表扬）、§10（B1-B8 待 PO 确认点）**；[`town-ui-entry-hud-spec.md`](town-ui-entry-hud-spec.md) **§0.3（A/B 接口契约）**；架构约束 [`../town-architecture-design.md`](../town-architecture-design.md) **§7.1/§7.2**
> 票面：`.scratch/handoffs/2026-11-13-T-UI-04-dispatch-brief.md`（T-UI-01/03、T-MAP-04 未完成，**最早可开工条件未满足**——本文件为预排稿，解阻后即插即用）
> 勘误提示：票面写「dialog-spec §8（B1-B8）」为**指针漂移**——B1-B8 实际在 **§10**；本文件按 §10 现状引用（勘误登记见 §9）
>
> **【2026-11-13 PO 变更·已核对】** 独立入口卡撤除、进入改「主路尽头白闪过场」（新缝权威 `town-entry-transition-visual-spec.md`）。本文件是**镇内会话 UI 预排，与入口缝正交**：§1-§9 全部规格不受影响。唯一受损引用面=§1.2「双蓝澄清」行对 `town-ui-entry-tokens.md` §1.2 入口卡 token 的引用（该章已随入口卡撤除作废）——已加注记改指存活权威；entry-hud-spec 引用面（§0.3/§4.3/§4.4/§6.2）均为存活章节。无需重发。变更溯源：`.scratch/town-seam-change/research-map-facts.md`。
>
> **【2026-11-16 案⑤同步】** 随案⑤立项（票 `T-UI-DLG-01`，`.scratch/town-design/tickets/T-UI-DLG-01-dialog-card-visual.md`），本文件 §1.2 token 现值表按 [`town-ui-dialog-spec.md`](town-ui-dialog-spec.md) **@9440be4**（2026-11-16 方向乙修订）全量对账：会话泡主底换 Soft White 白纸档 `#FFF9EC`@96%、圆角语言扩 12-28 且会话泡允许不对称四角、chip 转 pill 泡豆三档语义分色、动效表落方向乙档值；§1.4/§1.5/§1.6 受牵连行同步。**两处冲突以 spec 为准**（spec 头部修订注记即本承接口径）。只做现值同步与注记：不新增产品决策、不动 §2-§5 状态机/函数面/TTS 参数（冻结）、不推翻 B1-B8。

---

## 0. 对齐与边界说明

- **本文件性质**：对 `town-ui-dialog-spec.md` 的**预排落地细化**（构件 token 化、状态机×接口闭环矩阵、T-MAP-04 适配 seam、纯逻辑函数面、B1-B8 参数化、资产占位清单），不新增产品策略、不推翻 §10 已给默认值。
- **冲突裁决**：若本文件与定稿内部矛盾，**以定稿为准**；矛盾与指针漂移列入 §9「歧义 / 待需求线裁决」，不擅自裁决、不在施工端改视觉。
- **实现边界**：DOM/CSS 落点归 `css/*` 命名空间与 `js/town-ui-*` / `js/town-dialog-*` 模块（文件名取舍建议见 §5.1）；本文件只定规格与函数面，不写实现。
- **术语**：对齐 [`../../GLOSSARY.md`](../../GLOSSARY.md)（SpeechKit、ModeRegistry 等）与 `town-ui-dialog-spec.md` 状态命名。
- **引用勘误（消费口径）**：票面所指「entry-hud-spec §4.6（会话时收敛）」为指针漂移——entry-hud-spec §4.6 实际是「鼠标点选可发现性」；会话收敛语义的实际落点是 **§4.3 末段（主提示弱化/暂隐）+ §6.2（选中/会话中态降噪）+ §0.3（接口契约）**。本文件 §3 按实际落点消费（勘误登记见 §9）。

---

## 1. 三件套构件落细与 token 化（对齐 dialog-spec §4、§6）

### 1.1 构件与层级总览

| 构件 | 层级（z 序，自下而上） | 空间 | 生命周期 |
|---|---|---|---|
| World Bubble（S/M） | 世界提示层之上、Panel 之下 | 世界锚定（NPC 头顶/交互点，屏幕投影+视口夹紧） | L0/L1 短驻；会话中可并存但让位 Panel |
| Session Panel（含 Speaker Strip / 主体区 / 选项区） | 会话层（压过 A 侧非关键 HUD，对齐 entry-hud §0.3 屏幕层级行） | 屏幕空间，底部居中锚定 | 会话打开→关闭（greet..complete） |
| Option Chip / Action Ghost | Panel 内 | Panel 中部 / 右上或底角 | 随步骤（§6 每步 ≤3 选项 + 常驻无压力出口） |

- **三件套单一数据源**：三构件均由会话状态机派生视图（§5.2 `dialogViewFor`），UI 只派发意图（选择/关闭/重播），不直接改写世界/任务规则（dialog-spec §11）。
- **事件驱动**：状态/步骤变化走事件更新（`town-ui/dialog/*` + 内部 intent），不逐帧轮询重建 DOM；文本/图标按签名脏标刷新（架构 §8「HUD 文本/图标状态按签名/脏标刷新」口径）。

### 1.2 token 清单（`--town-dlg-*` 体例，延续 `town-ui-entry-tokens.md` 命名法）

**色彩 token**（值取 dialog-spec §4.1；来源盘 = `town-villagers-visual-spec.md` §3.1 与 UI 素材登记色 `.scratch/town-design/assets/ui/notes-ui.md` §2）：

| Token | 值 | 来源 | 用途 |
|---|---|---|---|
| `--town-dlg-panel-bg` | `#FFF9EC`（Soft White 白纸档，`--town-hud-soft-white` 字库成员） | §4.1（2026-11-16 方向乙·替代标注 A） | Panel/Bubble 泡主底（白纸档，同族大小泡） |
| `--town-dlg-panel-alt` | `#D7D2C8`（Stone Light，村民盘） | §4.1 | 点缀名档：尾尖内侧衬线/骑缝名牌底候选（暖纸系自会话泡主底降为点缀，2026-11-16 换岗） |
| `--town-dlg-panel-alpha` | `0.96`（区间 0.90–0.96 的上限档，区间本身不变） | §4.1（2026-11-16 方向乙） | Panel 半透明度（保上半屏世界可见） |
| `--town-dlg-line` | `#5A4636`（Outline Brown） | §4.1 | 描边 1–2px（逻辑像素） |
| `--town-dlg-text` | `#5A4636` | §4.1 | 主文字 |
| `--town-dlg-text-sub` | `#6B4E3D` | §4.1 | 辅助文字 |
| `--town-dlg-guide` | `#7EC8D8`（Sky Cloth，**村民盘**） | §4.1 | 引导/链接性交互强调 |
| `--town-dlg-go` | `#7FB069`（Meadow Green） | §4.1 | 正向/继续/完成主操作 |
| `--town-dlg-warm` | `#D96B52`（Market Red） | §4.1 | **仅温暖点缀**；禁错误/警告语义（硬约束） |
| `--town-dlg-guard` | `#6F8F5B`（Golem Vine） | §4.1 | 铁傀儡/守护语境身份条点缀 |
| `--town-dlg-hl` | `#F6C96B`（UI 高亮金，UI 素材登记新色） | notes-ui §2 | hover/选中柔光描边（与 UI-03 语言一致） |
| `--town-dlg-hl-warm` | `#FFD89A` @0.55（灯火暖 55% 档） | notes-ui §2 | hover 边中段细线点缀 |
| `--town-dlg-done` | `#9BCF7A`（麦绿） | notes-ui §2 | 完成勾/徽章角标（不另造「完成绿」）；=正向豆底值复用 |
| `--town-dlg-bean-warm`（命名建议，归实现票终裁） | `#FFD89A`（暖金亮档，= `--town-dlg-hl-warm` 基色） | spec §4.1 泡豆分色行（2026-11-16） | 推荐/中性豆底（视觉起始位） |
| `--town-dlg-bean-guide`（命名建议，归实现票终裁） | `#9AD6E2`（天蓝提亮档；基色 `#7EC8D8` = `--town-dlg-guide` 保留在册） | spec §4.1 泡豆分色行（2026-11-16） | 引导豆底（指引语义辅助通道） |
| `--town-dlg-bean-done`（命名建议，归实现票终裁） | `#9BCF7A`（麦绿，= `--town-dlg-done` 值复用） | spec §4.1 泡豆分色行（2026-11-16） | 正向豆底（完成向语义辅助通道） |

> 【2026-11-16 换岗注记】Bread Cream `#F4D9A6` 自会话泡主底降为点缀名档（骑缝名牌底/尾尖内侧衬线等，spec §4.1 替代标注 A）——B 侧如需独立点缀 token 可引用 A 侧同值 `--town-hud-base` 或新增点缀 token，命名归实现票终裁；豆三档为语义辅助通道，图标/排序仍是主信息（spec §4.1/§3 原则 1）。同值不同册防混用：`#FFD89A` 在 A 侧为 `--town-hud-gold-bright`、B 侧为 `--town-dlg-hl-warm` 基色/推荐豆，B 侧样式取 B 侧自有 token 单源，防跨册漂移（口径同下行双蓝澄清）。

> **双蓝澄清（非矛盾，防实现混用）**：B 侧会话引导语汇取**村民盘 Sky Cloth `#7EC8D8`**；A 侧入口卡点缀/高亮备选取**建筑盘布幔-天蓝 `#7EC8E3`**（`town-ui-entry-tokens.md` §1.2、entry-hud §6.2）。两色分属两套色盘、各有 spec 正确引用；实现不得把两个色值当同义名互换。圆角语言 **12–28px**（逻辑像素），会话泡允许不对称四角（Panel 落值 `28px 32px 26px 34px`，spec §4.1 替代硬数字标注 B；2026-11-16 方向乙取代原「统一 12–20、Panel 取上限 20」口径）；pill 泡豆 `999px` 全圆为构件形态语言，与圆角区间互不混用（spec §4.1 原文）。
>
> 【2026-11-13 PO 变更·核对】上一行对 `town-ui-entry-tokens.md` §1.2 的引用已随入口卡撤除**作废**（该章 token 进受损盘点态）；本行的存活权威 = **entry-hud-spec §6.2**（镇内高亮备选色，未受变更影响）。双蓝结论不变：B 侧 `#7EC8D8`（村民盘）/ A 侧 `#7EC8E3`（建筑盘）仍分属两套色盘，不得互换。

**尺寸与布局 token**（值取 dialog-spec §4.2/§4.3/§4.5；CSS 逻辑像素，按参考分辨率统一缩放）：

| Token | 值 | 依据 |
|---|---|---|
| `--town-dlg-panel-w` | `min(720px, 92vw)` | §4.2 Session Panel |
| `--town-dlg-panel-h` | `180–320px`（内容驱动、有上限） | §4.2 |
| `--town-dlg-panel-radius` | `28px 32px 26px 34px`（不对称毛边四角；圆角语言 12–28，替代理由指针=spec §4.1 替代硬数字标注 B） | §4.2/§4.1（2026-11-16 方向乙） |
| `--town-dlg-chip-radius` | `999px`（pill 全圆；构件形态语言，与 12–28 圆角区间互不混用，spec §4.1 有原文） | §4.1/§4.2（2026-11-16 加行） |
| `--town-dlg-panel-bottom` | `clamp(24px, 4vh, 40px)`（计入安全边距） | §4.2「距底 24-40」 |
| `--town-dlg-safe` | `16px` | §4.3 屏幕边距夹紧/避让间隙基准 |
| `--town-dlg-strip-h` | `48–56px`（Speaker Strip） | §4.2 |
| `--town-dlg-strip-offset`（命名建议，归实现票终裁） | `-12px`（骑缝名牌 `position:absolute` 半悬泡顶外沿上移、**零占位**；暖纸深一档底+墨描边+左身份色条 4×20px 圆头短条） | §4.2 Speaker 行（2026-11-16 方向乙加行） |
| `--town-dlg-chip-size` | `64px`（主选项触点） | §4.2/§4.5 |
| `--town-dlg-chip-hot` | `≥56px`（chip 热区下限；全局下限 ≥44） | §4.2/§4.5 |
| `--town-dlg-chip-icon` | `32–40px` | §4.2 |
| `--town-dlg-chip-label` | `≥18px` 等效，1–3 字（原 12–14px 系对 §4.4 字号线的欠账，spec §4.6-2 修正） | §4.2/§4.6-2（2026-11-16） |
| `--town-dlg-chip-gap` | `≥16px`（相邻选项间距，防误触；全局下限 ≥12） | §4.2/§4.5 |
| `--town-dlg-ghost-h` | `≥44px`（Action Ghost 文字按钮高） | §4.2 |
| `--town-dlg-bubble-s` | `72–160 × 56–72px`，内边距 `10–12px` | §4.2 Bubble-S |
| `--town-dlg-bubble-m` | `160–240 × 72–96px`（1 目标图标+指向箭头） | §4.2 Bubble-M |
| `--town-dlg-copy-size` | `≥18px` 等效，加粗圆润，1–4 字短文案 | §4.4 |

**影层 token**（2026-11-16 增；值照 spec §4.1 影层行——替代现状单层微影 `0 2px 6px rgb(90 70 54/25%)`，spec §4.6-3 公共欠账修正）：

| Token | 值 | 依据 |
|---|---|---|
| `--town-dlg-shadow-float`（命名建议，归实现票终裁） | `0 3px 0 rgb(90 70 54/15%), 0 12px 28px rgb(90 70 54/14%)`（近影贴边显厚度 + 远影大半径显悬浮；panel/bubble 共用） | spec §4.1 影层行 |
| `--town-dlg-shadow-bean`（命名建议，归实现票终裁） | `0 3px 0` 深一档同色鼓边（叠于豆底色之上） | spec §4.1 影层行 |

**动效 token**（值取 dialog-spec §5.4/§4.5；克制、无闪烁）：

| Token | 值 | 依据 |
|---|---|---|
| `--town-dlg-anim-in-bubble` | `180ms` 轻缩放+淡入（§5.4 窗内取值档；spec §4.6-1 欠账修正落值） | §4.2 Bubble-S 行 / §5.4（2026-11-16） |
| `--town-dlg-anim-in-panel` | `220ms`「吹泡泡」：scale `0.8→1.02→1` 双弹 + `translateY(20px)→0` + 淡入，`cubic-bezier(0.34, 1.56, 0.64, 1)`（§5.4 窗上限档；spec §4.6-1 欠账修正落值） | §4.2 Session Panel 行 / §5.4（2026-11-16） |
| `--town-dlg-anim-press` | `110ms` pressed `scale(0.97)`（豆被轻捏；§5.4 80–120 窗内取值；亮度反馈可选保留） | §4.2 chip 行 / §5.4/§4.5（2026-11-16 落值） |
| `--town-dlg-anim-step` | 步进内容交叉淡化 `≤150ms`，不跳屏 | §5.4 |
| `--town-dlg-anim-praise-in` | `180ms` 徽章弹入；停留 `≥800ms`；总时长 `1.2–2.0s` | §5.4/§4.2 |
| `--town-dlg-anim-out` | `200ms` 淡出 | §5.4 |

> 【2026-11-16 注】豆随 panel 整体入场**不逐个 stagger**（3 豆逐个入场会把总感知拖出步进 ≤150ms 窗，spec §4.2 Session Panel 行）；出场 `200ms` 淡出为 §5.4 冻结口径不变。

### 1.3 World Bubble（Bubble-S / Bubble-M）

- **锚定**：NPC 头顶/手持物上方逻辑点（参考村民头高 2.0 格、铁傀儡 2.7 格；实现取实际模型包围盒，对齐 villagers-visual-spec）；投影到屏幕后按 `--town-dlg-safe`（16px）**视口夹紧**，尾尖始终朝向锚点（§4.3）。
- **裁决**：同屏**仅 1 个主会话气泡**；背景 NPC 闲聊 bubble 默认关闭（B2，§10 默认），若未来启用须低于主会话优先级且不与其竞争注意力（§4.3）。
- **渲染路径（参数，默认建议）**：`bubble.renderPath = 'dom'`——屏幕空间 DOM 投影 + §1.2 token 绘制底板（缩放清晰、热区与夹紧易做、与 Panel 同 token 族）；备选 `'sprite'` 用 UI-02 位图作 3D Billboard（体素位图手感，需处理位图放大档位）。两路径共享 §1.2 色彩/尺寸 token；最终归实现票拍板（§9 歧义 6）。
- **与 A 全局提示不抢戏**：近身 bubble 出现时全局「点一点」提示退后（§2.3）；bubble 本身不发 `dialog/open`、不触发 A 收敛（见 §2.2 矩阵 idle/bubble 行）。

### 1.4 Session Panel

- **结构**（自上而下）：Speaker Strip（高 48–56：职业符号+名字短标签+名字色条；Seek 态追加 B6 目标缩略图）→ 主体区（1 个大图标/徽章位为主，短文案辅助）→ 选项区（Option Chip 横排 + Action Ghost）。
- **锚位（B1 默认）**：底部居中、`--town-dlg-panel-bottom` 计安全区；**上半屏 ≥55% 世界可见**；若与右上小地图同时可见，Panel 上沿低于小地图下沿且留 `≥16px` 间隙，不遮左上关键信息区（§4.3）。
- **稳定布局**：固定尺寸槽位/数值容器思路（§3 原则 5）；徽章位、图标位尺寸固定，状态切换不引发布局跳动。
- **半透明**：`--town-dlg-panel-alpha 0.96`（2026-11-16 方向乙：90–96 区间上限档，区间不变）；需要强调世界目标时**降低 Panel 视觉权重**而非给世界加暗遮罩（§4.3 无遮挡原则）。

### 1.5 Option Chip 与 Action Ghost（无压力出口）

- **Option Chip（pill 泡豆）**：横向 pill 泡豆 `border-radius 999px` 全圆；豆高 `64`（触点 `64×64`、热区 `≥56` 不变，pill 拉宽只增不减）+ 1–3 字标签 **≥18px**（spec §4.6-2 修正，原 12–14px 为欠账；icon 32–40 对现状 DOM=继续缺席，权衡登记见票 T-UI-DLG-01 §7.1）；**三档语义分色**（§1.2 豆 token 行：金=推荐位/蓝=指引/绿=完成向，语义辅助通道）；豆鼓边影 `0 3px 0` 深一档同色（§4.1 影层行）；按压 `110ms scale(0.97)`（豆被轻捏）；随 panel 整体入场**不 stagger**；**窄窗断点**（视口 ≤391px ≈ 92vw≤360px 等价档）label 转 icon 下方竖排、豆 `min-width 96px`（断点写死，spec §4.2）；每步 **1–3 个**（B3 默认 ≤3、无二级嵌套）；0 选项的纯展示回合突出单主操作「继续/好的」（§6.1）。
- **推荐位**：最自然的下一步置于视觉起始位（左侧首位）；所有选项均正向路径、**无错误选项惩罚**（§6.1）。
- **Action Ghost（次操作，视觉弱于主选项）**：字号 **≥18px**（spec §4.6-2 公共欠账修正之二；弱化用底色/描边表达，**不靠缩字号**）——
  - **稍后（关闭）**：Panel 右上角「×/挥手再见」图标 + 「稍后」短词，热区 `≥44px`，点击即 `dialog/close {result:'deferred'}`，**零负面反馈**（§6.2；B5 默认「稍后」/挥手再见图标，不出现「退出任务」压力词）。
  - **再听一次**：喇叭图标按钮，重播当前句 TTS，**不改变状态**（§6.2；B4 默认：每步自动播一次 + 提供再听一次）。
  - **无强制确认**：不弹「确定要离开吗」二次打断（§6.2）。
- **四态可辨**（§4.5）：default / hover（桌面增强，非前提）/ pressed / selected；disabled 极少用，仅「暂未解锁」语义且用中性灰+锁/睡眠图标，**不用红叉**。

### 1.6 热区 / 安全区 / 避让速查（硬约束清单）

| 项 | 值 | 依据 |
|---|---|---|
| 全部可点选热区 | `≥44×44` CSS px 等效 | §4.5 / MISSION / 架构 §7.2 |
| 主选项触点/热区 | `64×64` / `≥56×56` | §4.2 |
| 相邻热点间距 | `≥16px`（chip）/ `≥12px`（一般） | §4.5 |
| Panel 距底 | `24–40px`（计入安全区） | §4.2 |
| Bubble 视口夹紧 | 屏幕边距 `16px` | §4.3 |
| Panel 上沿 vs 小地图下沿 | 间隙 `≥16px`（若同时可见） | §4.3 |
| 上半屏世界可见 | `≥55%` | §4.3 |
| 窄窗断点（92vw 档） | 视口 ≤391px（= 92vw ≤360px 等价）→ chip label 转 icon 下方竖排、豆 `min-width 96px`（3 豆+2×gap16 ≈320 <360 ✓） | §4.2（2026-11-16 方向乙加行） |
| 验证分辨率 | 1280×720、1920×1080 及窄窗/平板宽高比不裁切 | §4.2 |

### 1.7 禁止项（对齐 §6.3 / MISSION，验收硬清单）

- 无倒计时条/数字读秒、无「超时失败」。
- 无「错误/失败/惩罚性再试一次」文案与红叉图形；Market Red 仅温暖点缀。
- 无键盘快捷键依赖、无拖拽/长按作为唯一通路（纯鼠标点选为唯一必要操作）。
- 无段落文本、数字进度百分比；数量/进度用 1–3 个实心/空心图符表达（§4.5）。

---

## 2. 会话状态机 × `town-ui/dialog/*` 接口闭环（对齐 §5、§2.2）

### 2.1 状态 id 归一

- 状态机图（§5.2）中 `BubbleHint` 与实现备注（§11）`bubble` 为同态异名；**实现统一用小写 id**：`idle / bubble / greet / guide / seek / help / respond / praise / complete`（§11 为实现导向小节，取其口径；命名漂移登记 §9）。
- 分层对应（§5.1）：idle=L0 前；bubble=L0 环境感知（**非会话**，不触发 A 收敛）；greet..praise=L1/L2；complete=L3 完成回执。

### 2.2 九态 × 呈现/事件映射矩阵

**意图（intent）词表（草案，命名以实现票定稿为准）**：`focus`（A 命中可交互）/ `blur`（移开）/ `click-npc`（点选 NPC，A→B 交接）/ `route`（greet 后按 sessionKind 分路）/ `pick-option`（选项点选）/ `target-found`（世界点中目标）/ `next-step`（praise 后步进）/ `end`（complete 自然结束）/ `continue-explore`（继续看看）/ `defer`（稍后/关闭）。

| 状态 | 进入（意图） | 退出（去向） | World Bubble | Session Panel | 选项/出口 | TTS 意图（模板 §8，最终文案待 PO） | `town-ui/dialog/*` 发射 |
|---|---|---|---|---|---|---|---|
| `idle` | 初始 / 会话结束 | `focus`→bubble | 无（B2 默认无背景闲聊气泡） | 无 | 无 | 无 | （close 已发完；无事件） |
| `bubble` | `focus`（A `town-ui/interact/focus`） | `blur`→idle；`click-npc`→greet | Bubble-S：身份/情绪/1 图标意图（挥手/名字/小图标），邀请非强迫 | 无 | 无（世界点选归 A 高亮语义） | 默认不播（B4 只管会话步；避免与 A 全局提示抢话） | **无**（局部提示不发 open，A 不收敛） |
| `greet` | `click-npc` | `route`→guide/seek/help；轻问候直接结束→close；`defer`→close | Bubble-S 挥手可短暂并存，Panel 打开后淡出 | **打开**（§5.4 入场）：Speaker Strip + 欢迎主体图标 | [挥手回应][稍后]；0 选项时单主操作「好的」 | 「你好呀，欢迎来玩！」自动一次 | **open** `{npcId, anchor, sessionKind, taskRef?}` + **update** `{step:'greet'}` |
| `guide` | `route`（观察导览） | 点选/查看→respond；`defer`→close | 可选 Bubble-M 地标指向箭头 | Panel：地标大图标 +「看」短词 | [知道啦][稍后]+[再听一次] | 「这是广场的大钟，大家会在这里集合。」自动一次 | **update** `{step:'guide', intent:'tour'}` |
| `seek` | `route`（寻找目标） | `target-found`→respond；**未点中不惩罚**，保持+温和重述；`defer`→close | 目标高亮归 A（UI-03）；可选 Bubble-M 目标图标提示 | Panel 常驻：**B6 目标缩略图**（Speaker Strip 旁）+目标大图标 | （世界点选）[再听一次][稍后] | 「可以帮我找找面包吗？」自动一次；再听一次=重播 | **update** `{step:'seek', intent:'find', hasPendingChoice:true}` |
| `help` | `route`（帮助/递交） | 完成帮助动作→respond；`defer`→close | — | Panel：1–2 图标选项（给予/挥手/一起走） | [给你][稍后]+[再听一次] | 引导短句（如「送给朵朵好不好？」）自动一次 | **update** `{step:'help', intent:'give'}` |
| `respond` | guide/seek/help 动作完成 | 确认即入 praise（**300ms 内可感知** §7.1） | — | Panel：目标图标+对勾（chip 高亮回弹锁定短暂） | 当前 chip 高亮锁定；出口照常可点 | 「找到了，送过去吧！」 | **update** `{step:'respond'}` |
| `praise` | respond 完成 | `next-step`→guide/seek/help（循环）；本轮完成→complete；`defer`→close | 可选 Bubble 旁小徽章 | **Praise Toast-in-Panel**：徽章 96–160 宽，弹入 180ms、停留 ≥800ms、1.2–2.0s 自然收敛（§4.4 规格） | **不阻塞**：继续/关闭/稍后照常可点 | 夸过程句（「你找到了！」「你愿意帮忙真好！」） | **update** `{step:'praise'}` |
| `complete` | praise（本轮小目标完成） | `end`→close(done)；`continue-explore`→close(continue) | NPC 开心表情联动（角色侧负责） | 徽章稍大一次 +「谢谢」主体；[继续看看][再见] | [继续看看][再见]（均为正向出口） | 「谢谢你，你帮了大忙！」 | **close** `{result:'done'\|'continue', taskRef?}`（close 前可播一次局部完成反馈 §7.3） |

- **update payload 语义**（§2.2）：`step`=状态 id；`intent`=当前会话意图语义（`tour`/`find`/`give`/…，枚举待 T-MAP-04 对齐）；`canClose` 本设计下恒 `true`（无压力出口常驻，字段保留为接口完备）；`hasPendingChoice` 在 seek 等待世界点选时为 `true`。
- **open 恰发一次**：从 `click-npc` 进入 greet 时发射；重复意图不重发（断言面见 §5.3）。
- **轻问候（L1）路径**：`click-npc`→greet→（微笑/挥手反馈后）close，`result='continue'`、无 `taskRef`（§5.3 场景 4：可无 Complete 任务语义）。
- **praise 步进（参数）**：`praise.autoAdvance=true`——dwell 结束自动步进（默认），玩家可提前点选；6 岁零阅读负担优先。待 PO 确认（§8 N3）。

### 2.3 close result 三值语义（建议默认，T-MAP-04 对齐时确认）

| result | 触发 | 语义 | A 侧行为（§3.2） |
|---|---|---|---|
| `deferred` | 任意态点「稍后」/关闭 | 「下次再来也可以」（§5.4 退出语义；零负面） | 仅恢复 HUD；任务状态不动 |
| `done` | complete 自然结束（`end`） | 本轮小目标达成；若关联任务推进 | 恢复 HUD + 任务提示位更新主状态（宣布权归 A §2.3） |
| `continue` | complete 选「继续看看」/轻问候收尾 | 会话关、探索继续（可能有后续轮） | 恢复 HUD；任务提示按任务侧状态刷新（不强行改主状态） |

### 2.4 T-MAP-04 适配 seam（期望接口形状草案——**非已定协议**）

T-MAP-04（交互锚点与轻任务状态钩子）未完成；以下为 B 侧**期望**的接口形状草案，供 T-MAP-04 落地协议时对齐；有出入以 T-MAP-04 定稿为准，差异走需求线：

```text
// —— 期望 T-MAP-04 提供（草案）——
// 1) 交互锚点注册/查询（纯数据）：
//    { id, kind: 'npc'|'landmark'|'prop', anchor:{x,y,z}, sessionKind?, taskRef?, targetId? }
// 2) 焦点事件（A 侧点击命中后广播，B 消费；对齐 §2.2 接口表前两行）：
//    town-ui/interact/focus {id, anchor, kind}  → 驱动 bubble
//    town-ui/interact/blur  {id}                → 回 idle
// 3) 玩法推进事件（世界/任务侧 → B，驱动 route/target-found/next-step）：
//    sessionKind ∈ 'greet'|'tour'|'seek'|'help'|'care'（care=B7 铁傀儡关怀，枚举待确认）
// 4) 任务上下文只读输入（A → B，§2.2 town-ui/task/context）：
//    { iconId, phase, npcId, labelShort }  // B 在 panel 内呼应当前小步，不替代 A 常驻任务条
// —— B 侧只派发意图、不写世界/任务规则（§11）——
```

**seam 歧义清单**（协议未定处，见 §9）：
1. `town-ui/dialog/open|close` 与括注事件名 `town:dialogue:opened|closed` 的并存关系（UI 命名空间事件 vs 应用事件名：谁是源、谁是镜像、A 侧订阅哪个）。
2. `close result` 三值精确语义（§2.3 为建议默认）。
3. Seek 期间 Panel 常驻还是收起（默认常驻+半透明；若玩法要求走动收起，收起后目标提示由 Bubble-M+目标图标承载，届时会话以 `continue` 语义挂起还是保持打开待定）。
4. `sessionKind` 枚举集与 `taskRef` 形状。
5. `target-found` 的触发源（A 命中系统直接上报 vs B 拦截世界点选）。
6. praise 后步进时机（自动 dwell 步进 vs 仅玩家点选；默认自动，§8 N3）。

---

## 3. A 侧收敛消费映射（对齐 entry-hud §0.3/§4.3 末段/§6.2；dialog-spec §2）

### 3.1 收敛矩阵（`town-ui/dialog/*` → A 侧各层动作）

| A 侧元素 | `dialog/open` 时 | 会话中（update） | `dialog/close` 时 | 依据 |
|---|---|---|---|---|
| L1 主任务/导览提示卡 | **弱化或暂隐**（避免双重信息轰炸） | 保持收敛态 | 恢复；若 `done`+`taskRef` → 任务提示位更新主状态 | entry-hud §4.3 末段；dialog-spec §2.2 |
| L2 方位指引（Landmark Pointer） | 降噪保留（Seek 有目标时保留指向，策略归 T-UI-02） | 可随目标更新 | 恢复常驻策略 | entry-hud §0.3；U4/U5 |
| L3 过程性表扬浮现位 | **让位**（会话内表扬归 B，§7.3 分工） | 同左 | A 全局完成反馈若需呈现，在 close 后**错峰**补位，不与 B 局部反馈叠加 | entry-hud §0.3 第 2 行；dialog-spec §7.3 |
| L4 系统轻入口 | **保留**（安全返回能力由 A 定） | 保留 | 保留 | dialog-spec §2.3 |
| 世界可交互高亮（UI-03 语义） | 当前会话对象保持选中环（天蓝冷静聚焦）；**世界其余可交互提示降噪** | 同左 | 恢复默认态；`done` 对象切完成标（草绿+暖金） | entry-hud §6.2 Active/Done 行 |
| A 侧自动 TTS（任务提示自动播报） | **抑制**（不抢话，参数 `tts.suppressAInSession=true`） | 同左 | 恢复 | dialog-spec §2.2 TTS 通道行；§4.2 本文件 |

- **收敛派生单源**：A 侧收敛态由 dialog 状态经 `hudConvergenceFor(state)`（§5.2）派生，A 不自抄会话状态镜像；`town-ui/dialog/close` 后收敛态必须恢复（断言面 §5.3 第 8 条）。
- **注意力主次**：进入 Session Panel 后玩家注意力归会话；A 保留最小必要 HUD，其余让位（dialog-spec §2.3）。

### 3.2 完成回执与 A 任务条分工（§2.3 / §7.3）

- **宣布权分工**：局部完成动画/夸奖由 B 即时呈现（Praise/Complete 徽章）；任务进度条目/常驻状态变更由 A 任务提示位落地——**两处不同时各说各话**。
- **时序**：B 在 `close(done)` 前播一次局部完成反馈（1.2–2.0s）→ 发 `close {result:'done', taskRef?}` → A 恢复 HUD 并更新任务提示。A 侧若再给全局反馈，须错峰且语义一致（同源 UI-04 构件，B8：会话内更紧凑）。
- **任务上下文呼应**：B 在 Panel 内显示「当前这一小步」呼应图标（消费 `town-ui/task/context` 只读输入），**不替代** A 常驻任务条（§2.2 接口表）。

---

## 4. 会话内表扬与 TTS 排队（对齐 §7、§4.4；架构 §7.2）

### 4.1 过程性表扬呈现规格（Praise / Complete / Respond）

| 场景 | 呈现（构件+节奏） | 资产（UI-04 映射，`.scratch` 现状） |
|---|---|---|
| Respond 即时确认 | 选项 chip 短暂高亮+轻微放大回弹+对勾/星闪；**动作被接收后 300ms 内可感知**（§7.1） | `town_ui_praise_star.svg` 轻量级（单星 16×16 放大显示）；对勾可复用 marker done 麦绿勾角标 |
| 单步 Praise | Praise Toast-in-Panel：徽章 96–160 宽+暖色柔光小范围扩散；弹入 180ms、停留 ≥800ms、总 1.2–2.0s；**不阻塞**继续/关闭 | 轻量级：star（寻找/观察类）/ flower（帮助/关爱类，G01 献花同款花） |
| 回合 Complete | 徽章稍大一次 + NPC 开心表情联动（角色侧）+ TTS 鼓励；可选热烈级点缀 | 热烈级：star/flower 簇（32×32）；大完成加 `town_ui_praise_confetti.svg` |
| 徽章累积 | 会话内 **1–3 枚小徽章**表示本轮已完成小步；**不倒扣、不清零**（§7.1）；Panel 内 Speaker Strip 右侧固定位 | 累积位用 16×16 内芯图符（复用 UI-04/UI-01 内芯） |

- **夸过程不夸标签**（§7.1）：文案语义「你找到了！」「你愿意帮忙真好！」「再看一看也很棒！」；不夸天赋、不比较、不评级。
- **B8 落地**：与 A 全局反馈**语义同源、构件复用（UI-04）**；会话内更紧凑——停留取 1.2s 下限档、粒子更少、尺寸仍在 96–160 带内。参数 `praise.sessionCompact=true`。
- **禁止**：红叉、灰暗失败蒙层、扣分动画、催促语；表扬粒子小范围、暖色、短时（§4.5）。

### 4.2 TTS 排队/仲裁参数面（统一语音出口 SpeechKit；仲裁规则记参数）

> 依据：dialog-spec §2.2 TTS 通道行（「会话播报优先级高于氛围闲聊，避免重叠抢话；具体仲裁策略由实现票定；B 负责声明本句需播报/可重播意图」）+ 架构 §7.2。以下为**参数面+默认值**，接线归实现票。

**优先级表**（`tts.priority`，数值高者优先）：

| 通道 | 优先级（默认） | 说明 |
|---|---|---|
| P0 氛围闲聊 | `0` | B2 默认关闭；世界音效走 AudioRegistry 不占语音通道 |
| P2 A 任务提示自动播报 | `2` | 会话打开期间被抑制（下行 `suppressAInSession`） |
| P4 会话步进播报 | `4` | 每步自动一次（B4）；如「你好呀，欢迎来玩！」 |
| P4 会话表扬播报 | `4` | 与步进同级（时序上在 respond 后 300ms 内） |
| P5 手动重播（再听一次） | `5` | 用户主动行为最优先响应；不改变状态（§6.2） |

**仲裁规则参数**（默认值可直接落，实现票可调）：

| 参数 | 默认值 | 语义 |
|---|---|---|
| `tts.preempt` | `'higher-only'` | 新句优先级 **严格大于** 当前播报才抢占（cancel+say）；否则入队 |
| `tts.queueMax` | `2` | 队列上限；满时**丢弃新句**（不堆积轰炸），记可观测钩子 |
| `tts.suppressAInSession` | `true` | 会话打开期间抑制 A 侧自动播报（不抢话）；A 卡上重播入口在弱化态不可点 |
| `tts.autoPerStep` | `'once'` | 每步自动播一次，不自动重复（B4）；重播仅手动 |
| `tts.debounceSameMs` | `800` | 同句 800ms 内不重复触发 |
| `tts.respectMute` | `true` | 遵循系统静音/无语音能力：界面仅靠图标+短文案仍可完成（§4.4 兜底） |

---

## 5. 状态机纯逻辑函数面（tdd 预排——**只定规格，不写实现**）

### 5.1 落点取舍：建议独立 `js/town-dialog-core.js`

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| A. 下沉 `js/town-ui-core.js`（T-MAP-04 关键产物名） | A+B 接缝（focus/dialog 事件）同文件；架构 §11 已点名 | T-MAP-04 与 T-UI-04 **两票并行写同一文件+同名单测**，合并冲突面大；交互锚点清单与会话状态机是两个模块语义，塞一文件违背「一文件一模块」（conventions §1） | 不推荐 |
| B. 独立 `js/town-dialog-core.js`（+ `test/town-dialog-core.test.js` 同名单测） | 票自包含、与 T-MAP-04 零文件冲突；`-core` 语义纯净（零 THREE/零 DOM/依赖注入/加载零副作用，conventions §1.2）；对 T-MAP-04 锚点数据经**注入**消费、不 import 世界知识（依赖方向单向） | A 侧收敛映射若放此处，A 消费方需订阅 dialog 事件（经 `hudConvergenceFor` 派生，见 §3.1，仍单源） | **建议** |

- 架构 §11 T-MAP-04 行写「`town-ui-core` **或等价状态模块**」——「或等价」容许独立文件；文件名最终归实现票/engineer-manager 合并序裁决，本表为设计侧建议。
- 本票若并入：T-MAP-04 侧只需保证 §2.4 seam 事件形状成立，dialog-core 通过注入的 `emit`/intent 适配层对接（缝在装配层 `js/town-ui-*`，不在 core 内焊协议）。

### 5.2 函数规格（接口签名草案；命名以实现票定稿为准）

```text
// js/town-dialog-core.js —— 会话状态机纯逻辑（零 THREE · 零 DOM · 依赖全注入 · 加载零副作用）
DIALOG_STATES        // 冻结常量：['idle','bubble','greet','guide','seek','help','respond','praise','complete']
DIALOG_TRANSITIONS   // 冻结转移表：{ [fromState]: { [intentType]: toState } }——与 §5.2 状态图逐边一一对应
DIALOG_INTENTS       // 冻结意图集（§2.2 词表草案）
DIALOG_OPTS          // 默认参数表：{ maxOptionsPerStep:3, allowNestedChoice:false, ambientBubbles:false,
                     //   praiseAutoAdvance:true, badgesMax:3 }（B2/B3/praise 步进/徽章上限参数面）

mkDialogMachine(opts) → machine
  opts = { emit(event, payload), now() }        // emit=事件出口注入（A 侧消费/可观测钩子 §11）；now=时钟注入（确定性）
  machine.state()    → stateId                  // 当前态（只读）
  machine.snapshot() → snapshot                 // { state, npcId, sessionKind, taskRef, stepN, badges,
                                                //   canClose:true, hasPendingChoice, targetIconId }
  machine.handle(intent) → { changed:boolean, events:object[] }
                                                // 单一驱动入口；当前态下非法意图 → { changed:false, events:[] }
                                                // （不 throw——零惩罚口径 + 可枚举测试）

// —— 纯派生函数（无状态，供 UI 渲染层与 A 侧直接消费）——
dialogViewFor(state, snapshot) → view           // { bubble:null|{size:'S'|'M', iconId, arrow?, anchorTo},
                                                //   panel:null|{ speaker, bodyIcon, targetThumb?, options[], ghost[] },
                                                //   praise:null|{ level:'light'|'cheer', iconId } }——§1 三件套视图模型
dialogEventsFor(from, to, snapshot) → object[]  // 该转移应发的 town-ui/dialog/* 事件序列（open/update/close 及 payload，§2.2）
hudConvergenceFor(state) → convergence          // { aL1:'full'|'dim'|'hidden', aPointer, aL3, aWorldNoise, aAutoTts }
                                                // A 侧收敛态映射唯一权威（§3.1 单源）
ttsPlanFor(utter, queue, opts) → plan           // { mode:'now'|'queue'|'drop', cancelCurrent?:boolean }
                                                // §4.2 仲裁纯决策（优先级/抢占/队列上限/抑制）
dialogBadgesAfter(badges, praiseEvent) → badges'// 徽章累积（cap=badgesMax 默认 3；不倒扣不清零 §7.1）
```

### 5.3 可测断言面（同名单测须覆盖的红线）

1. **转移表全覆盖**：9 态 × 全意图集枚举，outcome 全定义（无 undefined 边）——与 dialog-spec §5.2 状态图**逐边一一对应**断言（含 bubble→idle、greet/guide/seek/help→close、praise→guide|complete、complete→end）。
2. **非法意图不抛**：当前态下无关意图 → `{changed:false, events:[]}`，状态不变。
3. **open 恰发一次**：`click-npc` 进 greet 发 `open`；重复 `click-npc`/`focus` 不重发。
4. **close 三值路由**：`defer`→`deferred`、`end`→`done`、`continue-explore`→`continue`；payload 含 `taskRef` 透传。
5. **bubble 不发 open**：idle↔bubble 往返零 `town-ui/dialog/*` 事件（A 不收敛）。
6. **徽章上限**：`dialogBadgesAfter` 达 3 枚封顶、顺序稳定、只增不减。
7. **TTS 仲裁三分支**：`ttsPlanFor` 高优先抢占/入队/队列满丢新句；`suppressAInSession` 抑制 A 通道。
8. **收敛跃迁**：`hudConvergenceFor` 在 open 边收敛（L1 dim/hidden、世界降噪、A TTS 抑制）、close 后恢复 full。
9. **确定性**：同一意图序列（`now()` 注入相同）→ 相同 events 序列与终态。
10. **零突变**：snapshot/queue/badges 入参不被修改（纯函数红线）。
11. **会话可重入**：close 后再 `focus`→`click-npc` 开新会话，badges/stepN 干净（不串轮）。

---

## 6. B1–B8 参数化总表（默认值取 dialog-spec §10，落点显式）

| # | 待确认点 | 默认值（§10 已给） | 参数名（本文件命名） | 落点 | 消费处 |
|---|---|---|---|---|---|
| B1 | Session Panel 锚位 | **底部居中**（上半屏保世界视野与 NPC 面部） | `panel.anchor='bottom-center'` | `--town-dlg-panel-w/bottom` token + 装配布局 | Panel 布局、与小地图/任务条避让 |
| B2 | 同屏背景 NPC 闲聊 bubble | **默认关闭**（首版仅当前会话相关 bubble） | `DIALOG_OPTS.ambientBubbles=false` | core 常量 | bubble 裁决（§1.3）；P0 TTS 通道 |
| B3 | 选项上限与二级选择 | **每步 ≤3、无二级嵌套**（复杂任务拆步） | `DIALOG_OPTS.maxOptionsPerStep=3`、`allowNestedChoice=false` | core 常量 + Panel 渲染守卫 | Option Chip 区（§1.5） |
| B4 | TTS 自动播报策略 | **每步自动一次+「再听一次」**；遵循系统静音 | `tts.autoPerStep='once'`、`tts.respectMute=true` | §4.2 参数面（SpeechKit 接线） | 全会话 TTS |
| B5 | 关闭文案/图标语义 | **「稍后」/挥手再见**；不出现「退出任务」压力词 | `close.affordance={label:'稍后', icon:'wave-bye'}` | 文案表 + chip 图标位（占位 👋，§7.2） | Action Ghost（§1.5） |
| B6 | Seek 目标缩略图 | **常驻**（Seek 态 Speaker Strip 旁目标小图标） | `seek.targetThumb='persistent'` | Panel Strip 槽位（UI-05/UI-01 图标） | seek 态 Panel（§2.2） |
| B7 | 铁傀儡关怀首版范围 | **纳入轻交互（问候/感谢）**；裂纹修复未实现则仅氛围、不暴露「受伤数值」 | `golem.careSession='light'` | sessionKind `'care'` 路由 + `--town-dlg-guard` 身份条 | G01 会话（§5.3 场景 5） |
| B8 | 会话内完成反馈与 A 任务完成反馈视觉 | **语义同源、构件复用（UI-04），尺寸/停留会话内更紧凑** | `praise.sharedComponent=true`、`praise.sessionCompact=true` | UI-04 资产 + §4.1 节奏参数 | Praise/Complete、A L3 分工（§3.2） |

> B1–B8 默认值**均照 §10 落定、不阻塞排期**；PO 最终验收批次逐项确认后仅改参数不改结构。

---

## 7. 资产占位清单（B 侧消费视角；对齐 `town-assets-requirements.md` §7 语义 + `.scratch/town-design/assets/ui/` 现状核实 2026-11-13）

### 7.1 现有资产映射（`.scratch` 未入库，入库归资产票线；文件均存在已核实）

| 资产 ID | 现有文件（`.scratch/town-design/assets/ui/`） | B 侧用途 | 状态 |
|---|---|---|---|
| UI-02 气泡底板 | `town_ui_bubble_talk_short.svg`（40×26+尾）、`town_ui_bubble_talk_mid.svg`（64×34+尾）、`town_ui_bubble_praise.svg`（56×40 无尾） | Bubble-S/Bubble-M 底板（`renderPath='sprite'` 备选路径）；表扬气泡底板 | 可用；`renderPath='dom'` 默认路径下为备选（§1.3） |
| UI-04 表扬反馈 | `town_ui_praise_star.svg` / `town_ui_praise_flower.svg` / `town_ui_praise_confetti.svg`（各含轻量/热烈两级） | Praise Toast-in-Panel 徽章、Complete 徽章、Respond 星闪（§4.1 映射：star=寻找/观察、flower=帮助/关爱、confetti=大完成） | 可用（B8 复用同源） |
| UI-05 道具图标 | `town_ui_prop_{bread,wheat,bouquet,scroll,tray,bell,feedbag,hammer}.svg`（各含图标框版+无框本体） | Option Chip 图标、Seek 目标缩略图（B6）、Speaker Strip 职业符号占位 | 可用 |
| UI-01 标记图标 | `town_ui_marker_{belltower,plaza,lavachicken,farm,stash,windmill,find,help}.svg`（default/active/done + 16×16 内芯） | guide 态地标图标、seek 目标/任务语义缩略图（16×16 内芯） | 可用（与 A 共享语义） |
| UI-03 点选高亮 | `town_ui_select_hover.svg` / `town_ui_select_active.svg` | 会话对象选中环/世界其余降噪（**A 侧 owner，B 消费语义** §3.1） | 可用（归属 A 票接线） |

### 7.2 缺口与占位策略（零新增位图即可开工）

| 缺口 | 首版占位 | 后续 |
|---|---|---|
| 挥手/再见图标（greet 选项 + B5 关闭图标） | emoji **👋**（同 A 侧 U2 emoji 占位口径） | 资产线补自绘像素图标（模板已在 `tools/generate-ui-assets.mjs`，成本低） |
| 喇叭/再听一次图标（B 侧重播 + A §4.3 重播入口） | emoji **🔊**（**A+B 共用同一占位**，语义同图） | 同上 |
| Respond 对勾徽章 | 复用 `town_ui_praise_star.svg` 轻量级或拆 marker done 麦绿勾角标 | 非阻塞；如拆角标由生成脚本出单态贴图 |
| Speaker 头像位 | UI-05 无框本体职业符号 + 名字色条（§3 原则 4「角色即语境」） | 角色头像如需专属资产另立资产票（villagers 三视图已有） |
| Session Panel 底板 | **无需位图**：CSS token 绘制（§1.2，圆角/描边/半透明） | — |

**占位策略汇总**：B 侧首版可**零新增位图**开工（现有 SVG + 2 个 emoji 占位 + CSS token Panel）；挥手/喇叭像素图标为增强项，不阻塞 T-UI-04。

---

## 8. 待 PO 确认项汇总

**B1–B8**：默认值已按 §10 落定并参数化（§6 总表），非阻塞；供 PO 最终验收批次逐项勾选。

**本票新增（N1–N5，均给默认建议、非阻塞）**：

| # | 项 | 默认建议 | 落点 |
|---|---|---|---|
| N1 | `close result` 三值精确语义 | §2.3 语义表（deferred=稍后/done=完成自然结束/continue=继续看看或轻问候收尾） | core 事件 payload + A 侧行为 |
| N2 | Seek 期间 Panel 常驻 vs 收起 | **常驻+半透明**（§4.3 无遮挡原则；走动场景若实测遮挡再议收起方案） | Panel 生命周期 |
| N3 | praise 后步进时机 | **dwell 自动步进+可提前点选**（`praise.autoAdvance=true`） | core 参数 |
| N4 | `sessionKind` 枚举 | `'greet'|'tour'|'seek'|'help'|'care'` | T-MAP-04 协议对齐 |
| N5 | 挥手/喇叭 emoji 占位 | 👋 / 🔊（并入资产线像素图标替换计划） | §7.2 缺口表 |

---

## 9. 歧义 / 待需求线裁决（含指针漂移勘误登记）

**勘误候选（文档指针，不改行为）**：

1. 票面（dispatch-brief）「dialog-spec **§8**（B1-B8）」→ 实际 **§10**（§8 是「典型内容模板」）。
2. 票面「entry-hud-spec **§4.6**（会话时收敛——收敛事件来源）」→ 实际 **§4.3 末段 + §6.2 + §0.3**（§4.6 是「鼠标点选可发现性」）。
3. `town-ui-dialog-spec.md` §2.1/§2.2 两处引「A **§6.4**」（HUD 弱化/协调）→ 实际 **A §4.3 末段**（主提示弱化/暂隐）**+ §6.2**（选中/会话中降噪；§6.4 是「触控与热区前瞻」）。
4. `town-ui-dialog-spec.md` §5.2 图 `BubbleHint` vs §11 `bubble` 同态异名 → 本文件统一小写 id（§2.1），建议定稿勘误归一。

**设计澄清（非矛盾）**：

5. 双蓝并存：Sky Cloth `#7EC8D8`（村民盘，B 侧会话引导）vs 布幔-天蓝 `#7EC8E3`（建筑盘，A 侧卡片点缀/高亮备选）——取盘分工见 §1.2 注；实现勿混用。

**协议/实现未决（归 T-MAP-04 对齐或实现票，见 §2.4 歧义清单）**：

6. `town-ui/dialog/*` 与 `town:dialogue:*` 双事件名关系（源/镜像、A 订阅口径）。
7. `target-found` 触发源（A 命中上报 vs B 拦截世界点选）。
8. Bubble 渲染路径（`dom` 投影 vs UI-02 位图 sprite；默认建议 `dom`，参数化 §1.3）。
9. `taskRef` 形状与 `town-ui/task/context` payload 细节（A → B 只读输入）。

> 以上均不阻塞本预排稿；实现票开工前由需求线/T-MAP-04 定稿逐项销号。

---

## 10. 引用

- [`town-ui-dialog-spec.md`](town-ui-dialog-spec.md)（§2、§4–§7、§10 B1–B8——设计权威）
- [`town-ui-entry-hud-spec.md`](town-ui-entry-hud-spec.md)（§0.3 接口契约；§4.3 末段/§6.2 会话收敛实际落点；§4.4 表扬节奏。**【2026-11-13 PO 变更·核对】** 所引章节均存活；该文件 §3 入口卡章已废弃，与本文件无引用关系）
- [`town-ui-entry-tokens.md`](town-ui-entry-tokens.md)（token 体例先例；A 侧入口 token。**【2026-11-13 PO 变更·核对】** 延续面=token 命名体例（`--town-dlg-*` 体例来源，存活）；其 §1 入口卡 token 已作废、§1.2 引用改指 entry-hud-spec §6.2（见 §1.2 双蓝澄清核对注记），受损盘点见该文件顶部专章）
- [`../town-architecture-design.md`](../town-architecture-design.md)（§7.1/§7.2 UI 接线架构与约束；§11 票据拆解）
- [`../town-assets-requirements.md`](../town-assets-requirements.md)（§7 UI-01~05、§8 音频语义）
- [`../../MISSION.md`](../../MISSION.md)、[`../../GLOSSARY.md`](../../GLOSSARY.md)
- `.scratch/town-design/assets/ui/notes-ui.md`（UI 资产现状与登记新色——纯文本引用，未入库）
- `.scratch/handoffs/2026-11-13-T-UI-04-dispatch-brief.md`（票面——纯文本引用）

---

**文档结束**
