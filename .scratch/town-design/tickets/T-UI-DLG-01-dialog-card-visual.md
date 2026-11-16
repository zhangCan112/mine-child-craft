# T-UI-DLG-01 对话卡视觉实装票（案⑤转正 · 方向乙「毛边绘本对话泡」+ spec §4.6 公共欠账三项一次装）

> 波次：**三+（UI 视觉线）**
> blocking edges：**无硬边**——PO 选型已终拍（2026-11-16 六问批量实答，案⑤=方向乙·毛边绘本对话泡），spec 修订已定稿（commit 9440be4 并入集成），本票即 frontier。唯一冲突面=同 worktree 测试装具 8080 端口（§6 排期注记，终裁归 scrum）。
> 权威（**勿回退甲/丙方向；spec 与 prebuild 两处冲突以 spec 为准**）：`docs/design/town-ui-dialog-spec.md` **@9440be4**——§4.1/§4.2 按 PO 选型方向乙落格 + §4.6 公共欠账修正三项并入 + 头部修订注记（含 prebuild §1.2 同步承接口径；本票立项即兑现该承接，见 §3.2）。
> 案⑤溯源：设计线件二产出 `.scratch/town-design/receipts/dialog-visual-redesign-proposals.md`（甲/乙/丙三案）；PO 拍板记录=spec 头部修订注记「PO 2026-11-16 实答选乙」。
> 台账：`tickets/README.md` §1 案⑤行（本票为该占位行转正）。
> ⚠ **本线只立票不施工**：派工与施工排期归 scrum；票面只如实注记冲突面（§6）。

## 1. 目标

对话卡（会话三件套）视觉层按 spec §4.1/§4.2 方向乙 token 表实装 + §4.6 公共欠账三项一次装，**css/town.css 唯一施工文件，DOM/JS 零改**（尾尖/骑缝/毛边全部 CSS 伪元素可达，spec §4.2 头注背书）：

1. **panel 气泡化换皮**：白纸档泡底 `#FFF9EC` @96% + 不对称毛边四角 `28px 32px 26px 34px` + 静态墨尾尖 + 双层悬浮影 + Speaker 骑缝名牌 +「吹泡泡」入场 220ms（spec §4.2 Session Panel 行）。
2. **Option Chip 换 pill 泡豆语义分色**：999px 全圆、豆高 64、三档底色（金推荐/蓝引导/绿正向）、鼓边影、label ≥18px、按压 110ms scale(0.97)、窄窗断点写死（spec §4.2 Option Chip 行 + §4.1 泡豆分色行）。
3. **World Bubble 同族换皮**：白纸泡皮 + 墨色尾尖 + 毛边四角随同族（spec §4.2 Bubble-S/M 行）+ 入场动效回归 180ms。
4. **§4.6 公共欠账三项一次装**（design-lead 2026-11-16 追认：欠账回归、可先行、零选型耦合，工程票一次装）：入场动效回归 §5.4 / 短文案 18px 修正 / 双层影。
5. **Bread Cream `#F4D9A6` / Stone Light `#D7D2C8` 换岗**：自会话泡主底降为点缀名档（骑缝名牌底/尾尖内侧衬线等，spec §4.1 替代硬数字标注 A）。

## 2. 拍板边界（PO 终拍 2026-11-16；施工方勿重问 PO）

| 点 | 拍板 | 票面落地含义 |
|---|---|---|
| 案⑤方向 | **方向乙·毛边绘本对话泡**（六问批量实答，甲/丙落选） | 全部视觉值按 spec §4.1/§4.2 乙格落值；甲/丙方向残留=验收挡回项（§7.3） |
| 替代硬数字 A | 主底换 Soft White `#FFF9EC` 白纸档，暖纸系降点缀 | spec §4.1 表后标注 A 已写明幅度与理由（家族内换岗、零新造色），施工照落不重议 |
| 替代硬数字 B | 圆角 12-28 且允许不对称四角（Panel `28px 32px 26px 34px`） | pill 泡豆 999px 全圆为构件形态语言，与圆角区间互不混用（spec §4.1 原文） |
| §4.6 三项 | 并入本票一次装 | 入场动效/短文案 18px/双层影随票收口，不拆期 |
| 尾尖示意性 | 静态屏幕空间示意，非精确投影（「选乙即接受的示意性权衡」） | 已知权衡登记见 §7.1；精确指向归装配层另票 |

**协议冻结面清单（DOM/JS 零改=结构保证）**：

- 三件套空间关系（bubble 世界锚定 / panel 底部居中 / chip 在 panel 内）——spec §4.2 头注明文「零变化」；
- `DIALOG_STATES` 九态与转移表、意图词表（js/town-dialog-core.js 冻结常量，prebuild §5.2）；
- 事件名 `town-ui/dialog/*`（open/update/close）与既有事件链；
- B1-B8 默认值（spec §10，prebuild §6 参数化总表）；
- `DLG_AWAY_DIST=12`（js/town-ui-core.js:90）与 `TOWN_BUBBLE_GAP=12`（js/town-ui.js:98）；
- 出场 200ms 淡出（§5.4 冻结口径——时序归既有 JS 链，CSS 只配合淡出过渡，不写新 JS）；
- panel DOM 五件 `.town-dlg-speaker/-thumb/-body/-opts/-ghosts`（js/town-ui.js:354-367）与 chip/ghost 纯文字按钮形态（js/town-ui.js:796-798 / 813-815）——骑缝名牌/尾尖/毛边/身份色条全部走 CSS 伪元素与既有类样式重排，**不新增 DOM 节点、不加 JS 类、不注入 icon**。

## 3. 文件域（README §6 规约逐条回应）

### 3.1 §6 固定问句（债 3）：「本票是否有生成器/导出器会再生成既有产物？」

**无。** 本票为纯 CSS 手改（css/town.css 单文件）+ 文档/台账回填；`.scratch/town-design/gen/` 导出链、mob-look 档案、golden fixture、UI 资产生成器（tools/generate-ui-assets.mjs）零关联——方向乙三新构件（尾尖/骑缝/毛边）全部 CSS 伪元素/属性可达，**零新增位图**（prebuild §7.2「Session Panel 底板无需位图」口径延续）。

### 3.2 基线文件域

| 文件 | 动作 | 说明 |
|---|---|---|
| `css/town.css` | 改 | **唯一施工文件**：town-dlg- 段（:356-583）token 与规则按 spec §4.1/§4.2 翻新（panel 气泡化 / pill 泡豆 / bubble 换皮 / 入场动效 / reduced-motion 降级块扩面）；**:23-24 旧语注记随值翻新**——`--town-hud-surface` 与 B 侧 panel-bg「同值同语言」表述随主底换白纸档失效，注记改写为 A 侧自有暖纸表面语言（**surface 值本身不动**，A 侧 HUD 非本票面）；:364-366 与 :430-432 段内 revamp-spec §3-H 旧值注记随值翻新（值改处注记跟手，出处如实标注） |
| `docs/design/town-ui-dialog-prebuild.md` | 改 | **已随本票立项同步完成**（2026-11-16 修订注记 + §1.2 色彩/尺寸/动效三表对账 + 影层增表 + §1.4/§1.5/§1.6 受牵连行）——施工期为对账底册；若施工中发现遗漏旧值，同票补写并回填票面 |
| 本票面 + `tickets/README.md` | 改 | 施工记录回填 + 台账案⑤行状态列（**他行勿碰**——T-NPC-13 行归工程线收口自改） |

**红线（不在文件域=结构保证）**：`js/` 全域（含 town-ui.js / town-dialog-core.js / town-ui-core.js）· `index.html` · `test/` 断言逻辑（§3.3 条款面）· `docs/design/town-ui-dialog-spec.md`（@9440be4 定稿勿动）· `docs/adr/0012-*` · T-NPC-13/14 票面与 DECISION-RELAY · 工程线同树脏文件（test/ 四 M + town-npc-behavior-core.test.js 新）。

### 3.3 守门测试面：施工前复核条款 + 条件债 5 条款

**立票日复核已做**（2026-11-16；证据行号为立票日现状，同树并行施工可能致行号漂移，施工方以断言语义定位）：

- `test/town-ui-core.test.js:365-400`（⑤ CSS token 对齐守门）：只锁 A 侧 `--town-hud-*` 八色值（**含 `#fff9ec`/`#ffd89a` 家族色在册**）+ `--town-hud-safe: clamp(16px, 1.6vw, 24px)` + `--town-hit-min: 44px` + 三槽类在位 + 缺席锁（`town-hud-card`/`is-idle-exploring`/`is-step-done`/`adv-town-arrive`）+ `prefers-reduced-motion` 在册——方向乙不动 A 侧 token、不引入缺席锁字串，**全保**。
- `test/town-ui.test.js:1503-1528`（CSS 守门切片）：锁 token 名在册（`--town-dlg-panel-bg`/`--town-dlg-chip-size`/`--town-dlg-panel-bottom`，**不锁值**）+ `.town-dlg-chip` 块含 `64` + `.town-dlg-ghost` 块含 `44` + 零警示红正则（`#f00\b|#ff0000|:\s*red\b`）+ `prefers-reduced-motion` + **字面锁 `--town-dlg-guide: #7ec8d8`**（:1520，冒号后空格）+ `.town-dlg-thumb` 块走 `var(--town-dlg-guide)` 且不引 `--town-hud-sky`（:1522-1527）——方向乙保留 guide 基色档（spec §4.1「基色档保留，目标缩略图沿用」），**全保**。

**预判=守门测试面零翻新，文件域不含 test/**。施工方开工前须按本条款复核上述两断言面未被工程线后续改动牵动；**若复核推翻预判**（如断言升级为锁值）：测试面列入文件域，并按 README §6 债 5 自动追加「conventions.md / GLOSSARY 对应表述回写」义务，**两改同收口不许拆期**；词条计数勿手数，收尾跑 `node --test test/conventions.test.js` 的 GLOSSARY 断言验平。

**GLOSSARY 零词条变动**：纯 CSS 施工无新模块 interface，收词判据（≥2 文件引用）不满足；票面照实登记零变动，conventions.test.js 的 GLOSSARY 断言不受影响。

### 3.4 施工红线细目（CSS 面内）

- 不得改写 `--town-dlg-guide` 基色行（字面 `#7ec8d8` 被 test/town-ui.test.js:1520 锁死）——引导豆提亮档 `#9AD6E2` 走**新增行**；
- 不得引入 `#f00`/`#ff0000`/`: red`（零警示红正则）；Market Red `#D96B52` 仅温暖点缀、不作错误/警告（spec §4.1 不变条款）；
- stylelint declaration-colon-space-after=always（既有守门注释口径），新声明冒号后带空格；
- `prefers-reduced-motion` 降级块保持并覆盖全部新增 @keyframes/animation（零过渡零闪烁，§4.5）。

## 4. 施工形状（CSS-only 落法；token 命名自由度归本票施工，值以 spec 为准）

- **token 落点**：`.town-dlg-layer` 既有 token 段（css/town.css:363-375）翻新 + 增行；token 命名建议见 prebuild §1.2（2026-11-16 同步版，豆三档/影层命名标注「命名归实现票终裁」=本票施工终裁；不撞 `--town-hud-*` A 侧命名空间）。
- **panel 气泡化**：主底/四角/影层走 token；尾尖 `.town-dlg-panel::after` 实心三角朝下（既有 `.town-dlg-bubble.is-anchored::after` :419-428 同法先例），不占布局位；入场走 `@keyframes` 吹泡泡——§4.6-1 欠账根因即「`transition: opacity` 对 display 切换不播放」（§4.6 现状列），animation 在显示时播放即修复；出场保持 opacity 过渡配合既有 JS 200ms 时序。
- **骑缝名牌**：落在既有 `.town-dlg-speaker` 元素样式重排（`position:absolute`、上移 -12px 半悬泡顶外沿、零占位）；暖纸深一档底 + 墨描边；左侧身份色条 4×20px 圆头短条走 `::before`（首版统一暖金档；守护语境按 §4.1 用 Golem Vine）。B6 目标缩略图 `.town-dlg-thumb`「泡中泡」换皮：外圈 3px 柔白 `#FFF9EC` 包边圈（§4.2 目标缩略图行）；与名牌相邻关系由 CSS 布局实现（spec：名牌旁），DOM 冻结。
- **pill 泡豆语义分色的 CSS-only 落法**：chip DOM 为纯文字按钮、无逐豆语义类（js/town-ui.js:796-798，冻结面）——三档分色走**结构位选择器**：首位推荐豆 `#FFD89A`（`:first-child`；金=推荐位=视觉起始位，§6.1 排序原则承载）、次位引导豆 `#9AD6E2`（`:nth-child(2)`）、末位正向豆 `#9BCF7A`（`:last-child`）。语义分色是辅助通道（§4.1），排序/icon 仍是主信息；若 PO 实屏要求逐豆显式语义类，属 JS 加类=冻结面，另票（§7.1）。
- **窄窗断点**：spec §4.2「panel 实宽 ≤360px（92vw 窄窗档）」以视口媒体查询等价落死：`@media (max-width: 391px)`（92vw ≤ 360px 的等价视口宽）——断点写死在规格内不留临场发挥；窄窗档 label 转 icon 下方竖排（现状纯文字豆：竖排退化、min-width 生效）+ 豆 `min-width: 96px`。
- **Bubble 换皮**：白纸泡皮 + 墨尾既有底子（:379-428）改泡底值；毛边四角随同族处理（spec §4.1 标注 B「小泡随同族处理」——四角不等、12-28 区间内，Bubble 具体四值施工裁并记入施工记录）；入场 180ms 轻缩放+淡入 @keyframes（§4.6-1）。
- **Praise 徽章**：换皮「白泡徽章 + 墨描边」（§4.2 Praise 行）——现状为无底牌纯浮字（:543-555），加底牌走既有元素样式（零新 DOM）；动效节奏冻结=弹入 180ms/停留 ≥800ms（§5.4），现状 200ms 字面对齐 180ms（§4 复核项 3）。

**施工前复核项（立票人已核并给默认；施工方复核后按默认落，有异议回票登记，不擅自改）**：

1. **panel 宽度既有分歧（非本票裁决面）**：spec §4.2 宽 `min(720px, 92vw)`（案⑤修订标注「不变」=未重议）vs 现状 css `clamp(360px, 42vw, 600px)`（`docs/design/town-visual-revamp-spec.md` §3-H 六值裁决，明文否决 720：「1600 屏占 45% 压死画面」）。**默认：宽度不动**（本票只做泡化换皮），分歧登记 §7.2 待需求线另呈。注意：revamp 宽度式下中等视口（约 860-1080px）三豆横排（spec §4.2 算术 ≈416px）可能触发既有 flex-wrap 换行——是否可接受归 PO 实屏判，不预先改宽。
2. **窄窗断点实现口径**：按「92vw 窄窗档」语义取视口媒体查询（§4 落法），**不按 panel 实宽测量**——revamp 宽度式 floor=360px 会使「实宽=360」在中等视口整段误触发，违背 spec 本意；两种宽度式下 `max-width: 391px` 语义同义。
3. **praise 弹入时长**：spec §4.2/§5.4 冻结值 **180ms** vs 现状 200ms（revamp-spec §3-H 残留）。**默认：以 spec 为准对齐 180ms**（换皮同时一行字面顺手对齐）。

## 5. 验收标准（token 逐项对账 spec @9440be4；终验=PO 实屏）

### 5.1 绿（对账硬数字——值出 spec §4.1/§4.2 原文行，逐项可查）

**色彩与质感**：

| # | 项 | 落值 | spec 出处 |
|---|---|---|---|
| 1 | 泡主底（Panel+Bubble 同款白纸泡皮） | `#FFF9EC` @ **96%**（90-96 区间上限档，区间不变）；`#F4D9A6`/`#D7D2C8` 降点缀（骑缝名牌底/尾尖内侧衬线等） | §4.1 主底行 + 标注 A |
| 2 | 描边与尾尖 | `#5A4636` 1-2px 不变；panel 墨尾尖 `::after` 实心三角朝下、不占布局位 | §4.1 描边行 / §4.2 Panel 行 |
| 3 | 毛边四角 | panel `28px 32px 26px 34px`；圆角语言 12-28；bubble 随同族（四角不等、12-28 内，值记施工记录） | §4.1 圆角行 + 标注 B / §4.2 |
| 4 | pill 泡豆 | `border-radius: 999px` 全圆（构件形态语言，与 12-28 互不混用） | §4.1 圆角行 / §4.2 chip 行 |
| 5 | 豆三档 | 推荐 `#FFD89A`（=hl-warm 基色）/ 引导 `#9AD6E2`（基色 `#7EC8D8` 保留在册）/ 正向 `#9BCF7A`（=done 值复用）；`--town-dlg-go #7FB069` 基色档保留；Market Red `#D96B52` 仅点缀不作错误/警告 | §4.1 泡豆分色行 |
| 6 | 影层 | panel/bubble 双层 `0 3px 0 rgb(90 70 54/15%), 0 12px 28px rgb(90 70 54/14%)`；豆鼓边影 `0 3px 0` 深一档同色 | §4.1 影层行 |
| 7 | 对比度 | 白泡主文 ≈7.9:1；三豆 ≈6.4 / 5.6 / 4.8:1 全过 AA 正文线（无需大字豁免） | §4.1 主底行/泡豆行 |

**字号**：

| # | 项 | 落值 | spec 出处 |
|---|---|---|---|
| 8 | body / ghost / chip-label | 全部 **≥18px**（现状 body 17 / ghost 15 / chip-label 12-14 逐项翻新）；speaker 20 不变；ghost 弱化用底色/描边表达不靠缩字号 | §4.6-2 / §4.2 |

**构件与布局**：

| # | 项 | 落值 | spec 出处 |
|---|---|---|---|
| 9 | 骑缝名牌 | 高 48-56 不变；`position:absolute` 半悬泡顶外沿**上移 -12px、零占位**；暖纸深一档底 + 墨描边 + 左身份色条 4×20px 圆头短条（首版暖金档） | §4.2 Speaker 行 |
| 10 | 泡豆尺寸 | 豆高 64（触点 64×64、热区 ≥56×56 不变，pill 拉宽只增不减）；相邻间距 ≥16 不变 | §4.2 chip 行 |
| 11 | 窄窗断点 | 视口 ≤391px（92vw 档等价）：label 竖排、豆 `min-width: 96px`（3 豆 + 2×gap16 ≈320 < 360 ✓）；宽窗横排；断点写死 | §4.2 chip 行 |
| 12 | 世界可见 | 上半屏 ≥55% 不受影响（骑缝/尾尖均零占位装饰） | §4.2 头注 / §4.3 |

**动效**：

| # | 项 | 落值 | spec 出处 |
|---|---|---|---|
| 13 | panel 吹泡泡入场 | **220ms**：scale `0.8→1.02→1` 双弹 + `translateY(20px)→0` + 淡入，`cubic-bezier(0.34, 1.56, 0.64, 1)` | §4.2 Panel 行 |
| 14 | bubble 入场 | **180ms** 轻缩放+淡入 | §4.2 Bubble-S 行 |
| 15 | 按压 | **110ms scale(0.97)**（豆被轻捏） | §4.2 chip 行 / §4.5 |
| 16 | 出场 | **200ms 淡出**（冻结口径；JS 时序链不动） | §4.2 Panel 行 / §5.4 |
| 17 | 豆入场 | 随 panel 整体入场**不逐个 stagger**（3 豆逐个会把总感知拖出步进 ≤150ms 窗，合规优先） | §4.2 Panel 行 |
| 18 | praise | 换皮白泡徽章+墨描边；节奏冻结=弹入 180ms / 停留 ≥800ms / 总 1.2-2.0s | §4.2 Praise 行 / §5.4 |

**守门（结构性）**：零警示红（正则口径）· `--town-dlg-guide: #7ec8d8` 字面保持 · thumb 走 `var(--town-dlg-guide)` 且不引 `--town-hud-sky` · `prefers-reduced-motion` 降级块保持并覆盖新增动效 · A 侧 `--town-hud-*` 八色与 `--town-hud-safe`/`--town-hit-min` 零漂移 · 缺席锁四串（`town-hud-card`/`is-idle-exploring`/`is-step-done`/`adv-town-arrive`）继续缺席。

### 5.2 §4.6 三项落点对照

| # | 欠账（现状） | 落点 |
|---|---|---|
| 1 | 入场动效回归 §5.4（现状：display 切换零动效） | 验收 13 / 14 |
| 2 | 短文案 18px（现状 body 17 / ghost 15 / chip 12-14） | 验收 8 |
| 3 | 双层影（现状单层微影 `0 2px 6px rgb(90 70 54/25%)` 几乎不可感知） | 验收 6 |

### 5.3 终验与收尾义务

- **终验=PO 实屏**（§5.1 对账为施工面自检）：1280×720 / 1920×1080 / 窄窗三档走查——不裁切、不遮挡关键视线；**骑缝名牌出界裁切为重点核对项**（spec §4.2 Speaker 行风险面注记：仅视觉裁切风险，不碰 §4.3 布局线）。
- `npm test` 当值全量 0 红 + `npm run lint` 三关零错（**以施工日当值基线为准**——同树工程线 a2+b1 若已上链勿引立票日数字；跑测前确认无并行会话占用 8080，见 §6）。
- §3.3 复核条款兑现（结论回填票面施工记录）；GLOSSARY 零词条变动复核（`node --test test/conventions.test.js` 断言验平）。
- 提交纪律：conventions.md §7 Windows 纪律拆单条 commit，只 `git add` 本票文件域文件（工程线同树未提交改动勿裹挟）。

## 6. 施工排期注记（终裁归 scrum，票面只如实注记冲突面）

- **文件域零交集**：本票纯 css/town.css，与工程线 a2+b1 面（js/adventure*.js + test/ 四 M 一新）及 T-NPC-14 面（js/adventure-dims-core.js + js/modes/adventure.js + test/ 两文件 + 文档）零文件交集。
- **装具撞车面**：`npm test` 含 boot 全链冒烟起本地服务占 **8080 端口**——同 worktree 双会话并行跑测试装具会撞。**串行排队：本票排在 T-NPC-14 施工之后**，由 scrum 派工时执行；若 scrum 另裁（独立 worktree 并行 / 错峰），按其终裁执行，票面不预设。
- 若另开 worktree：按 `docs/worktree-pitfalls.md` 独立 `npm install --ignore-scripts --strict-ssl=false`（禁 junction）、删树前 `cmd /c rmdir` 摘链接、删后 `session_move` 回主仓。

## 7. 波次注记与登记

### 7.1 已知权衡登记（选乙即接受，不阻塞本票）

- **尾尖=静态示意非精确投影**：永远朝下只是「有人在说话」的绘本式示意，非逐帧投影、不锚 NPC 实位（spec §4.2「选乙即接受的示意性权衡」原文口径）。PO 实屏若提出「尖精确指人」：精确指向（复用 bubble is-anchored 既有机制思路的装配层写入）**归装配层另票**，不随本票。
- **语义分色位次承载**：豆三档语义-位次对应（§4 落法）在 DOM 冻结下由 §6.1 排序原则承载，非逐豆显式标记；PO 实屏若要求逐豆语义类，JS 面=冻结面另票。
- **icon 位缺席**：现状 chip=纯文字按钮（T-NPC-11 装配产物，无 icon 子元素）；spec §4.2「icon 32-40 不变」对现状=继续缺席；PO 实屏若要求图标豆，装配层 DOM 面=冻结面另票。

### 7.2 spec 间既有分歧登记（待需求线另呈，不静默处理）

- **panel 宽度**：dialog-spec §4.2 `min(720px, 92vw)`（案⑤修订标注「不变」=未重议）vs `town-visual-revamp-spec.md` §3-H `min(42vw, 600px)` 下限 360（现状落值，明文否决 720）。本票默认宽度不动（§4 复核项 1）；对齐与否归 PO/需求线另票，销号前 css 注记须如实标注两出处。
- **praise 弹入**：dialog-spec §5.4 **180ms** vs revamp-spec §3-H 200ms 残留——本票按 spec 对齐 180ms（§4 复核项 3）。

### 7.3 防夹带清单（一律挡回）

- 精确指向装配层缝（尾尖逐帧投影 / 锚 NPC 实位）；
- DOM/JS 结构改动（新增节点 / 加类 / 改 chip 构建逻辑 / icon 注入）；
- 状态机/事件/参数面改动（DIALOG_STATES / 意图词表 / DLG_AWAY_DIST / TOWN_BUBBLE_GAP / TTS 参数）;
- **甲/丙方向残留**（spec 已按乙落格，任何出自甲/丙案卷的视觉语言回流=挡回；案卷见 `receipts/dialog-visual-redesign-proposals.md`）——含旧主底 `#F4D9A6` 回潮作会话泡主底、对称等角圆角（读作几何卡片）等乙格外值；
- panel 宽度对齐 spec 720（§7.2 分歧未销号前不动）；
- test/ 断言改源（预判零翻新；若复核推翻按 §3.3 条件条款走——那是规约路径，非夹带）。
