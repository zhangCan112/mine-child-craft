# T-UI-05 走查清单与参数总表（执行稿）

> 票：T-UI-05 UI 联调、可达性走查与文案/TTS 默认值落地（ui_scope A+B，polish 票）
> 执行：tdd-engineer（红方主人）· 2026-11-14 · 施工基线=town-design @ `2c9168d`
> 走查标尺：`town-ui-entry-hud-spec.md` §8/§4.5 · `town-ui-dialog-spec.md` §8/§4.5/§2/§7.1 ·
> `town-entry-transition-visual-spec.md`（话术/演出权威）§A.4/§A.6/§A.7/§B.3 ·
> `town-ui-entry-tokens.md`（受损盘点态）· MISSION.md · `town-architecture-design.md` §7.2/§12.5
> 语境基点：**2026-11-13 PO 变更**（ADR-0011）——主路径起点=冒险 home 图东向主路尽头，白闪进镇；
> 本清单全部核对项按此语境（U1-U3 迁移替换后表述）。
> 证据口径：机械可核段一律给「测试文件：行号 / 代码切片：行号」；不可机械核的标「**人工项·待 PO 实机**」不虚勾。

---

## 1. 主路径纯鼠标可达（§12.5 门槛·PO 改写语境六段）

主路径：**进入冒险（home 图）→ 沿东向主路步行到尽头 → 白闪进镇 → 识别地标 → 获得提示 → 点选交互/对话**。

### 1.1 进入冒险 home 图 ✅ 机械核
- 主菜单→冒险为既有模式缝（本票域外既有面，零改动核对）；城镇**无独立入口卡**（PO 变更撤除，`town-ui-entry-hud-spec.md` §3 废弃注记）——主菜单不存在城镇卡=语境迁移核对项 ✅（U1/U2/U3 旧卡面参数面已作废，tokens §0′ 盘点表）。
- 键盘零依赖：进入与后续全部段落的输入面=鼠标移动+左键点选（§1.6 点选链测试装具即纯 mousemove/pointerdown/pointerup，`test/town-ui.test.js:818`/`:872`）。

### 1.2 沿东向主路步行到尽头 ✅ 机械核（触发几何）＋人工项（体感）
- 触发线=主径带式判据「走到路尽头才触发」：`js/adventure-core.js:847` `x >= 157 && (z === 74 || z === 75)` 返回 `'east'`（与三向全缘行形状不同，主径轴线 z74~75×栅栏线 x≈157，切片注释 :840-843）。
- east **恒开放**（无解锁键/无时段窗）：`js/adventure-core.js:832` `if (dir === 'east') return true;`——「随时可去」语义，任务链不锁 town（E2E 断言在册 `test/adventure-mode.test.js:4789` 测试名末段）。
- 引导阶梯（§B.2 世界内语言零 HUD）：东带①土斑（x128~139）→②土斑+花田（x140~151）→③主径连续（x152~156）→尽头告示牌+栅栏缝+剪影（§B.3）；件零改动、读法升级（`js/adventure-core.js:1554` 栅栏 x157/告示牌/主径/花田/剪影坐标零重叠切片）。
- **人工项·待 PO 实机**：步行段「广场→东带」中段指引体感（若不足→望塔基座路标色块增强项，§B.2 已登记不阻塞）。

### 1.3 白闪进镇 ✅ 机械核（全链 E2E 在册）
- **踩线即白闪直进，零弹窗**（U3 强化·§A.6）：`js/modes/adventure.js:2837-2840` 触发线命中→`advEdgeOpenDir('east')`=true→`advVeilFire({to:'town', kind:'edge'})`——触发链上**无任何确认分支/弹窗代码路径**（切片核对零二次确认）。
- 白闪语言=Veil Edge Variant 暖白径向渐变：`kind='edge'` 挂 `#portalVeil.edge`（`js/modes/adventure.js:2671`），css `css/style.css:1113-1118` 中心暖白 `rgb(255 250 240 / 88%)`→边缘 `#ffefd0`（忌纯白刺眼忌纯黑口径注释 :1109-1110）。
- 时序：0.4s 淡入+满格瞬间同步切换+0.4s 淡出=0.8s（`ADV_VEIL_T`，advVeilTick `js/modes/adventure.js:2743-2758`），满格瞬间 `portal_travel` 音（:2680）。
- 到达演出：维度分流 `advSetDim('town')`+到达播报 `advSpeak('到小镇啦！')`+toast `🏘️ 到小镇啦！`（:2708-2710，A.4 到达播报主案落齐）。
- 镇维度行：`js/adventure-dims-core.js:640-653`——sky 暖亮天蓝/dayCycle false 恒白天/mood calm/`spawn yaw 0=面北望广场`（:649-651，A.7 第三拍 face:'north' 落实）/hud.banner（:652）/showMobs false。
- **E2E 机械锚**：`test/adventure-mode.test.js:4789`「T-SEAM-02 去程进镇端到端：主径踩线带内恒开放白闪→advSetDim→spawn @(79,25,112)·播报/toast·任务链不锁 town」；到达播报/toast 断言 :4803-4804。
- 回程半边（B.5 双向边缘白闪）：`ADV_TOWN_RETURN_Z=132` 带式触发（`js/modes/adventure.js:2876-2892`）→`advVeilFire({to:'home', kind:'edge'})`→到达「回到家啦！」+🏡（:2726-2727）；零门件紫调（:2867 注释「回程无门件(紫调地图门语义不进镇口)」）。

### 1.4 识别地标 ✅ 机械核＋人工项
- 落点 (79,25,112) 面北=钟塔走廊正前方（spawn 锚 `js/town-map-core.js:47`，bell-tower (79,24,76) :48；E2E 断言 spawn @ (79,25,112)）；「世界本身就是欢迎演出」（A.7 第二拍：钟塔即演出零 UI 组件）。
- 镇名牌 banner 常驻：维度行 `hud.banner` 槽（现值见 §8 U1 行）。
- **人工项·待 PO 实机**：白闪退场瞬间「剪影显影成真」叙事闭环的实机观感；banner 与上半屏视线不遮挡核对。

### 1.5 获得提示 ✅ 机械核
- L1 主提示卡：focus→进行中+自动朗读完整句一次（`test/town-ui.test.js:280-294`：卡四件套/短标签「钟塔」/TTS 重播钮可见/`rec.speech.spoken === ['我们去钟塔吧！']`）。
- L2 方位指引：目标态/钟塔弱提示态/距离三档/方位四离散（`test/town-ui.test.js:568`/`:616`/`:630`；纯决策面 `test/town-ui-core.test.js` 指引三函数组）。
- 无目标=「随便逛逛」探索中轻状态（P-V1，`test/town-ui.test.js:219` 组+`:304` 停留后收起回探索中）。
- 重播钮（U6）：cancel-then-speak 不重叠抢话不改状态（`test/town-ui.test.js:322`）。

### 1.6 点选交互/对话 ✅ 机械核
- 会话全链（seek 主链）：点选接任务→世界点中目标→respond→confirm 泵→praise（B 徽章+A 槽零双弹）→dwell 自动步进→complete→再见→close{done+taskRef}→A 落完成一步+错峰表扬（`test/town-ui.test.js:1455-1493` 逐边断言）。
- 真清单点选（T-UI-04F 改约后）：三处同锚遮挡逐锚 E2E——tour-plaza→guide / find-bread→seek / visit-stash→seek，命中对象=task 本尊（`test/town-ui.test.js:1855-1897`）。
- 会话中 A 侧收敛/恢复：open→L1/L2 收敛 L4 恒在；close(continue) 恢复；close(done+taskRef) 落完成一步（`test/town-ui.test.js:356`/`:383`）。
- 无压力出口：「稍后」defer 会话零负面（`test/town-ui.test.js:1435`）。

---

## 2. 过场窗禁焦虑清单核对（visual spec §A.6 逐项）

| # | 禁止项 | 核对证据 | 结论 |
|---|---|---|---|
| 1 | 进度条/精确百分比/「加载中」长条 | 白闪纯 opacity 逐帧直驱（`js/modes/adventure.js:2644-2648` advVeilSet），无任何进度 UI 元素；切界同步帧级（advVeilArrive 满格瞬间） | ✅ |
| 2 | 倒计时/沙漏/读秒 | 转场 0.4s+0.4s 双段常量（ADV_VEIL_T），零倒计时呈现；城镇 UI 参数面禁词守门（`test/town-dialog-core.test.js:635-644` timeout/countdown/deadline 族键零在册） | ✅ |
| 3 | 纯黑/纯白刺眼 | `.edge` 暖白径向渐变 `#ffefd0` 族（`css/style.css:1113-1118`，css 注释「忌纯白刺眼忌纯黑」D3 幼儿口径） | ✅ |
| 4 | 惊吓闪（快闪/频闪/爆闪/音爆） | 双段舒缓渐变（0.4s×2），非闪烁；音效=`portal_travel` 既有柔和档零新增（A.5 首版零新增音可交付） | ✅ |
| 5 | 失败/警告语义（红屏/警示音/危险符号） | 越线=「到达」播报（「到小镇啦！」非「掉出世界」）；触发链零失败分支（advEdgeTick 直进） | ✅ |
| 6 | **紫调遮罩**（本缝新增） | `advVeilEdgeCls(kind==='edge'||'rite')` 才挂 `.edge` 白闪（:2671）；紫渐变是基段（地图门语义），本缝过场恒白闪；回程同口径（:2867 零门件紫调） | ✅ |
| 7 | **二次确认弹窗/风险提示**（本缝新增） | 触发线命中→`advVeilFire` 直进（:2838-2840），零确认零弹窗代码路径；E2E `test/adventure-mode.test.js:4789` 全链无弹窗步骤 | ✅ |
| 8 | 过场触发表扬/气泡（U7 中性核对） | `advVeilArrive` 只有 sfx/speak/toast（:2680-2710），零表扬调用（tokens §3「进入为中性过渡不触发表扬」口径平移成立） | ✅ |

---

## 3. 热区 ≥44px 抽查 ✅ 机械核

| 可点元素 | 证据 |
|---|---|
| 参数单源 | `js/town-ui-core.js:43` `HIT_MIN_PX: 44`（冻结参数表）；`css/town.css:25` `--town-hit-min: 44px` |
| L1 TTS 重播钮 | `css/town.css:102-104` min-width: var(--town-hit-min) |
| L4 回主菜单钮 | `css/town.css:150`（min-width 44px 档） |
| B 侧 Option Chip 主选项 | `css/town.css:494` min-width: 64px（§4.5 推荐 64×64 主选项档） |
| B 侧 Action Ghost（稍后/再听） | `css/town.css:511-519` min-width/min-height 44px（「热区 ≥44px §4.5 硬约束」注释） |
| 会话 CSS 守门 | `test/town-ui.test.js:1588`（CSS token 守门：44/64+panel 底部安全+动效窗逐项） |
| 世界对象点选 | 准星命中双门（角度 8°+距离 24 格）=指针锁定世界的热区映射（`js/town-ui-core.js:63-66`，§8 HL_AIM 行）；点选链纯鼠标事件（`test/town-ui.test.js:872`） |

**人工项·待 PO 实机**：chip/ghost 实机点选手感（相邻间距 ≥12-16px 的实际误触率）。

---

## 4. 对比度抽查（token 核）✅ 机械核

| 面 | token/值 | 结论 |
|---|---|---|
| L1 卡/会话面板主文 | `--town-hud-ink: #5a4636` on `--town-hud-base: #f4d9a6`（94% 不透明，`css/town.css:10-11`/`:59-60`） | 对比度 ≈6.5:1，过 WCAG AA（≥4.5:1）；=dialog-spec §4.1 主文 `#5A4636`/Bread Cream `#F4D9A6` 权威对 ✅ |
| 色板禁警示红 | token 全表=暖金/天蓝/草绿/奶油/深棕（`css/town.css:9-21`）；守门断言 `test/town-ui-core.test.js:890`（`!/\bred\b|#f00\b|#ff0000/`） | ✅ §4.5 第三条 |
| 双蓝分工 | `--town-dlg-guide: #7ec8d8`（村民盘 Sky Cloth，B 侧引导）≠ `--town-hud-sky: #7ec8e3`（A 侧建筑盘布幔-天蓝），css :19-21 注释明示勿互换 | ✅ F2 拨正在册 |
| 高亮可见性 | 高亮金 `--town-hud-gold-bright: #ffd89a`（权威值）；资产 `#F6C96B` 并存分工归 PO（CS-2a/2b 待裁，本票不判） | 转录 §12 |

---

## 5. 无压力文案核对（hud-spec §4.5 四条 + dialog-spec §6.3）✅ 机械核

1. **不显示倒计时/沙漏/进度耗尽条**：TOWN_UI_PARAMS/DIALOG_OPTS 全表无 timeout/countdown/fail/penalty 族键（`test/town-dialog-core.test.js:635-644` 禁词锁定守门；`test/town-ui-core.test.js` 参数表逐键断言）；话术守门 `!/\d+秒|\d+s\b/`（`test/town-dialog-core.test.js:561`）→ ✅
2. **不显示失败/错误/惩罚；重试语义中性无代价**：关闭三值路由 deferred=零负面（`test/town-ui.test.js:1435`「稍后→A 恢复原态+零负面」）；核心「任意事件序列不产生失败态」守门（`test/town-ui-core.test.js` §4.5 硬约束组）→ ✅
3. **不使用高饱和警示红作为常态 UI 色**：见 §4 对比度行 → ✅
4. **任务提示可关闭/收起且不因关闭产生负面后果**：「稍后」ghost 恒在（`canClose: true` 无压力出口恒可关，`js/town-dialog-core.js:281`）；L4 回主菜单永不收敛（`js/town-ui-core.js:155` l4 恒 normal + `js/town-ui.js:384` sysSlot.hidden=false）→ ✅

补充（B5）：关闭文案=「稍后」/挥手再见语义，零「退出任务」压力词（`js/town-dialog-core.js:55` closeAffordance；`test/town-ui.test.js:1389`）。

---

## 6. 过程性表扬节奏（U7/P-S1/N3）与 F5 praise 截断走查结论

### 6.1 节奏参数 ✅ 机械核
- A 侧：`PRAISE_MS [1200,2000]`（U7 窗，`js/town-ui-core.js:50`）+ `PRAISE_QUEUE_MAX 1` + `U7_PRAISE_SINGLE true`（:51-52 同屏 1 条）；装配取窗中点 1600ms（`js/town-ui.js:87-90` 同源派生不另立权威）；表扬定时窗断言 `test/town-ui.test.js:301-302`。
- B 侧：`praiseInMs 180`/`praiseDwellMinMs 800`/`praiseTotalMs [1200,2000]`（`js/town-dialog-core.js:62-64`，参数表锁 `test/town-dialog-core.test.js:89-90`）；徽章停留 ≥800ms 感知窗语义在册。
- 不堆叠：praiseShow 复用同一条（`js/town-ui.js:796`「复用同一条=U7 同屏 1 条」）；会话中 A 侧表扬冻结零双弹（`test/town-ui.test.js:1470-1475`）。
- 文案导向：夸过程不夸标签——本票已按 §7.1 改写三处（§10）。

### 6.2 F5 praise 截断——走查结论：**确认截断，已消解（销号）**
- **确认**：B 侧 praise 步进播报经 `speakDlgStep` cancel-then-speak（`js/town-ui.js:726-728`）；praise dwell 泵原取 `praiseTotalMs[0]`=1200ms（:743），到点 `next-step`→下一态 UPDATE 再 cancel（:753-755）。praise 句 11 字符（「做得好！给你一颗小星星！」）中文 TTS 正常语速 ≈2.2s+，1200ms 步进即掐断=**截断成立**（PO 待裁条款 8 预判证实）。
- **消解（交付物 3 授权域，登记 diff）**：dwell 默认取 `praiseTotalMs[1]`=2000ms（窗上限，参数表本身 [1200,2000] 锁不动）；兜底常量 1200→2000 同步镜像。红锚 `test/town-ui.test.js:1906`（praise 态在册定时恰一只且 ms===2000）红→绿。
- **人工项·待 PO 实机**：2000ms 实机听感复核（表扬句完整可听+不拖沓）。

---

## 7. 告示牌改读核对（§B.3）

- **形制现状**：x156 立式双柱牌=拼块形制**无字**（`js/adventure-core.js:1448`「③告示牌牌面=拼块形制无字」；:1479 advEdgeEastSign 构造切片）——§B.3「T7 登记偏差顺势收编」前提成立。
- **主案方向核对**：§B.3 主案=「图标为体，零文字依赖」（板面拼块改读「钟塔+小径向东」图案，与栅栏缝外剪影互文）。现状拼块无字=零文字依赖方向一致；**专属像素图案（钟塔意象 16×16/32×32）归 UI-01 资产票**，本票零资产改动。
- **辅案文案**：「小镇在这边！」未落（无字现状）；若 PO 走查裁需字，落点=advEdgeEastSign 板面（资产/贴图域，非本票）。
- **人工项·待 PO 实机**：牌面图案读法实机核对（「牌上画的=缝里看见的」互文是否可感知）；栅栏缝「看得见、马上就能过去」读法；剪影灯点「小镇亮着灯等你来」读法。

---

## 8. U1-U8 / B1-B8 参数总表（并表·PO 一处改动落点·U1-U3 语境迁移后表述）

> 状态口径：✅=默认已落且走查核对通过；⚙=参数面在册、PO 一处改即生效；△=待 PO 裁决项。改动入口全部单点（改值不返工结构）。

### 8.1 U1-U3（语境迁移后；权威=town-entry-transition-visual-spec §A/§B）

| # | 核对项（迁移后） | 现值/默认 | 实现落点 | PO 一处改动入口 | 状态 |
|---|---|---|---|---|---|
| U1 | **触发/到达 TTS + 镇名牌 banner**（原卡标题/副标题迁入过场语境）：触发播报「我们去小镇啦！」/到达播报「到小镇啦！」/banner | 到达播报 `advSpeak('到小镇啦！')`+toast 🏘️（`js/modes/adventure.js:2709-2710`）✅；banner 现值 `'🏘️ 小镇 · Midport Village'`（`js/adventure-dims-core.js:652`，**现值锁** `test/adventure-dims-core.test.js:196`「文案终稿, ui-designer」）；触发播报「我们去小镇啦！」**未接线**——§A.4 兜底方案（只保留到达播报，到达语义优先）成立 | 播报字符串两处 + 维度行 hud.banner | 播报/banner 字符串值（各一处）；触发播报接线=增强项归 PO 批次 | ✅到达 / △banner 副语 vs §A.7 主案「🏘️ 米德波特小镇 · 广场真热闹」差异（现值锁在先、spec 主案在后）——归 PO 裁决，本票不改 |
| U2 | **图标去向**（原入口卡主图标迁入）：banner 🏘️ emoji 占位 + 告示牌板面图案（钟塔意象） | banner 🏘️ 占位在册（banner 值内）；告示牌=拼块无字（图案归 UI-01 资产票，§7） | banner emoji 字符 + UI-01 资产票 | emoji 字符 / 资产路径（资产票面） | ✅（占位策略延续）；像素图标=资产票非本票 |
| U3 | **「踩线即白闪直进，零弹窗」**（原无二次确认强化） | east 恒开放→advVeilFire 直进，零确认分支（§1.3/§2 #7） | 缝语义非参数（advEdgeTick :2837-2840） | 无参数面（语义红线） | ✅ 机械 E2E 在册 |

### 8.2 U4-U8（镇内 HUD/指引/反馈；权威=hud-spec §8 → hud-prebuild → core 参数表）

| # | 参数 | 默认值 | 实现落点 | PO 一处改动入口 | 状态 |
|---|---|---|---|---|---|
| U4 | 指引形态 | `U4_POINTER_MODE: 'landmark-pointer'` | `js/town-ui-core.js:56` | 该键枚举值 | ✅⚙ |
| U5 | 无目标回落 | `U5_FALLBACK: 'belltower-fallback'`（钟塔弱提示） | `js/town-ui-core.js:57` | 该键枚举值（合法域 belltower-fallback\|hidden） | ✅⚙ |
| U6 | 重播/收起 | `U6_REPLAY: true` / `U6_MANUAL_DISMISS: false` | `js/town-ui-core.js:58-59` | 两布尔键 | ✅⚙ |
| U7 | 表扬节奏上限 | `PRAISE_MS [1200,2000]`+`PRAISE_QUEUE_MAX 1`+`U7_PRAISE_SINGLE true` | `js/town-ui-core.js:50-52` | 区间值/布尔键 | ✅⚙ |
| U8 | 分区 B 流程项 | `U8_PROCESS_ITEM: null`（非视觉参数，如实标注） | `js/town-ui-core.js:60` | 无（流程项） | ✅ |

### 8.3 B1-B8（会话 UI；权威=dialog-spec §10 → dialog-prebuild → DIALOG_OPTS）

| # | 参数 | 默认值 | 实现落点（`js/town-dialog-core.js:48-69`） | PO 一处改动入口 | 状态 |
|---|---|---|---|---|---|
| B1 | Panel 锚位 | `panelAnchor: 'bottom-center'` | :49 | 枚举值 | ✅⚙ |
| B2 | 背景闲聊 bubble | `ambientBubbles: false` | :50 | 布尔 | ✅⚙ |
| B3 | 选项上限/嵌套 | `maxOptionsPerStep: 3` / `allowNestedChoice: false` | :51-52 | 数值/布尔 | ✅⚙ |
| B4 | TTS 自动播报 | `ttsAutoPerStep: 'once'` / `ttsRespectMute: true` | :53-54 | 两键 | ✅⚙ |
| B5 | 关闭文案/图标 | `closeAffordance: {label:'稍后', icon:'wave-bye'}` | :55 | 文案/图标值 | ✅⚙ |
| B6 | Seek 目标缩略图 | `seekTargetThumb: 'persistent'` | :56 | 枚举值 | ✅⚙ |
| B7 | 铁傀儡关怀 | `golemCareSession: 'light'` | :57 | 枚举值 | ✅⚙ |
| B8 | 反馈构件同源 | `praiseSharedComponent: true` / `praiseSessionCompact: true` | :58-59 | 两布尔 | ✅⚙ |

### 8.4 N 系（T-UI-04 新增登记）+ 本票 F5 取值点

| 键 | 值 | 说明 |
|---|---|---|
| `praiseAutoAdvance` | true | N3 dwell 自动步进（:60） |
| `badgesMax` | 3 | 徽章累积 1-3 枚封顶丢新（:61） |
| `praiseInMs` / `praiseDwellMinMs` | 180 / 800 | 徽章弹入/停留下限（:62-63） |
| `praiseTotalMs` | [1200, 2000] | 表扬总时长窗（:64，参数表锁）；**本票新增取值点：装配层 `dlgDwellMs` 取 `[1]` 上限（F5 消解，`js/town-ui.js:741-746`）——PO 调窗即联动，零第二权威** |
| `ttsPreempt`/`ttsQueueMax`/`ttsSuppressAInSession`/`ttsDebounceSameMs` | 'higher-only'/2/true/800 | TTS 仲裁参数（:65-68，供 `ttsPlanFor` 消费；装配层接线=增强项见 §9） |

### 8.5 P 系（T-UI-01..03 新增登记；`js/town-ui-core.js`）

| 键 | 值 | 说明 |
|---|---|---|
| `P_V1`/`P_H1`/`P_H2` | 'dim'/'hidden'/'hidden' | L1 无任务轻状态/会话中 L1、L2 暂隐（:53-55，townHudDimming 消费） |
| `P_S1` | 队列深 1 | `PRAISE_QUEUE_MAX`（:51） |
| `P_D1`/`P_D2` | 12 / 40 | 「就在附近」/「近远」阈值（:61-62，townPointerBand 消费，注入可覆盖） |
| `A1`（方位粒度） | 4 方位离散 | townPointerHeading 四离散 front/left/right/behind（:219-232，函数域即参数） |

### 8.6 HL_AIM 两键（T-UI-03 施工裁量·依据链转录）

| 键 | 值 | 依据链（转录自 PO 待裁清单条款 3，全文在 `.scratch/town-seam-change/retro-notes-engineering-line.md`） |
|---|---|---|
| `HL_AIM_DEG` | 8 | 8°=6 岁宽容热区→准星锥角映射（体素锚点 10-20 格张角 1.5-2.5°，取约 4 倍宽容）；施工裁量默认、无新增 U 编号；代码参数表同表单源（`js/town-ui-core.js:63-64`，锁表断言 `test/town-ui-core.test.js`「参数(T-UI-03)」组）；PO 追认挂条款 3 |
| `HL_AIM_MAX_DIST` | 24 | 24 格=广场尺度外缘「走到跟前才亮」（钟塔 20/农场 10），与 P_D2_NEAR=40 留 16 格级差不抢戏（:65-66）；PO 调参位=core `townHlHit` 第三参 opts 注入（运行时覆盖零改表） |
| 随附口径 | — | §4.6「悬停切可点选态光标」在准星世界模型下豁免（准星即光标，准星本体反馈归票线新立）——已在条款 3 登记 |

---

## 9. TTS 统一出口终检 + 零消费函数终检记录

### 9.1 统一出口 ✅
装配层全部语音出口收敛于注入的 `speech`（SpeechKit 单通道），cancel-then-speak 不重叠抢话：
- A 侧提示句：`js/town-ui.js:823-828`（tts-hint 意图，句式=core `townHintSentence`「我们去X吧！」）；重播钮 :297-301。
- B 侧步进句：`speakDlgStep` :722-729（greet 瞬态不播=矩阵行）；「再听一次」ghost `replayDlgSentence` :716-719（不改变状态）。
- 离镇清场：`leaveTown` `speech.cancel()`（:876 提示句不残声）。
- 会话避让：dialogOpen 闸吞 A 侧 tts-hint（:821+会话冻结测试 `test/town-ui.test.js:1552`）；A 句被闸吞断言 :1395-1396。

### 9.2 `ttsPlanFor`/`hudConvergenceFor` 零消费——终检记录（接线不做）
- `DIALOG_CORE` 解构面恰五键：`DIALOG_EVENTS`/`DIALOG_OPTS`/`mkDialogMachine`/`dialogViewFor`/`dialogUtterFor`（`js/town-ui.js:65-69`），不含 `ttsPlanFor`/`hudConvergenceFor`——两纯函数**参数面在册、装配层零消费**（grep 全库核对：仅 core 定义+core 单测+prebuild 文档引用）。（2026-11-14 评审订正：初版误记「恰六键」，实为五键。）
- 语义达成面：B 通道 cancel-then-speak + A 侧会话冻结闸已覆盖「会话播报优先/收敛恢复」行为语义（既有测试在册）；收敛档由 `townHudDimming`+dialogEvent 手工承载。
- **处置**：接线（完整排队/抢占/收敛单源化）=增强项归 PO 批次（PO 待裁条款 8 后半在册）；本票零接线改动——登记终检记录，不虚勾「已接线」。

---

## 10. 文案 §7.1 改写登记（交付物 3 授权域）

> 授权依据（2026-11-14 评审订正：初版所引「派单交付物 3：违 §7.1 的标签式表扬…本票只落 §7.1 明文导向」在 brief 中不存在，现改照 brief :38 原文并补真实依据链）：派单交付物 3 原文=「**文案/TTS 默认值落地与统一出口排队终检**」——文案落地在本票授权域内；改写边界=dialog-spec §7.1 反馈原则明文导向（禁标签式表扬），话术风格总体裁决仍归 PO 待裁条款 7、F5 dwell 窗归条款 8。守门锚 `test/town-dialog-core.test.js:649`（禁词表 `真厉害|真棒|真聪明`，防回归）。

| 处 | 原句（违例） | 改后 | 依据 |
|---|---|---|---|
| DIALOG_UTTER_TPL.respond | 「找到啦, 真厉害!」 | 「找到啦, 你找得真认真!」 | 「真厉害」=天赋/标签式；hud-spec §4.4 例句「你找得很认真」过程导向；保留「找到啦」确认语义 |
| DIALOG_UTTER_TPL.complete | 「我们完成啦, 真棒!」 | 「我们完成啦, 你帮了大忙!」 | dialog-spec §8 完成表扬模板 TTS「谢谢你，你帮了大忙！」参与导向 |
| PANEL_BODY.praise | 「你真棒!」 | 「谢谢帮忙!」 | 票面明令禁例「你真棒」类；hud-spec §4.4「谢谢你帮忙」；1-4 字短文案形制保持（dialog-spec §4.4） |
| DIALOG_UTTER_TPL.praise | 「做得好!给你一颗小星星!」 | **不改** | 「做得好」=过程（所做之事）非天赋标签，§7.1 不禁；最小 diff |
| greet/guide/seek/help 句 | — | **不改** | 无标签式表扬；seek `{n}` 插值契约保持（测试锁定） |

- PANEL_BODY.praise 系面板显文（非 dialogUtterFor 六态句字面），改写理由：票面禁例词「你真棒」在库唯一显文落点即此处，§7.1 反馈原则覆盖「图标+TTS」双通道——**登记为本票对授权域的解释性延伸，提请 PO 复核**（条款 7 总体裁决不受影响）。
- greet chip「挥手再见」vs §8 模板「挥手回应」之辨**不在本票改**（非 §7.1 标签式表扬类，条款 7 已在册）。

---

## 11. 微调落地登记（本票代码微调全量=三处+三锚，最小 diff）

| # | 文件 | 改动 | 红锚（红→绿） | 性质 |
|---|---|---|---|---|
| 1 | `js/town-ui.js` | `dlgDwellMs` 取 `praiseTotalMs[1]`+兜底镜像 2000（F5 消解） | `test/town-ui.test.js:1906` | 默认值落地（交付物 3） |
| 2 | `js/town-ui-core.js` | tieTask `best.id` 补 typeof 守卫（语义零变） | `test/town-ui-core.test.js:897` | 04F note N1 防御补齐（派单已知可选顺手项） |
| 3 | `js/town-dialog-core.js` | §7.1 文案三处改写+:121 注释补导向字样 | `test/town-dialog-core.test.js:649` | 文案落地（交付物 3） |

- 红自证：`99 tests / 96 pass / 3 fail`（红因逐一吻合预期，日志 `.scratch/logs/tui05-red.log`）；绿验收（红方亲跑）：同命令 **99/99/0 EXIT 0**（`.scratch/logs/tui05-green.log`）。
- 三门（红方亲跑）：`npm test` **2071 tests / 2070 pass / 0 fail / 1 skipped（既有先例）EXIT 0**（`.scratch/logs/tui05-npmtest.log`）；`npm run lint` **EXIT 0**（`.scratch/logs/tui05-lint.log`）。
- 红线核对：`js/prefab-kit.js`、`test/prefab-kit.test.js`、`js/town-interact-core.js`、`test/town-interact-core.test.js`、`js/modes/adventure.js` 相对基线**零 hunk**；测试文件仅红锚纯追加（+19/+17/+22 行，零删除=既有断言零触碰）。
- commit：见回执（js 三文件+test 三锚+本走查清单文档逐文件 add）。

---

## 12. 累计走查项销号/转录状态表（前票评审登记逐项）

| 来源 | 项 | 处置 | 状态 |
|---|---|---|---|
| T-UI-02 P1 | prebuild §3.2 切换交叉淡化+外环缩放 | 走查核对记录归档：现状切换=签名门控脏标（签名变才落类，无闪烁承诺已测 `test/town-ui.test.js:646`），无交叉淡化/外环缩放过渡——**不改视觉值**（prebuild §0「不在施工端改视觉」，PO 条款 6 在册） | 转录归档 |
| T-UI-02 P2 | §3.1 near 档图标 1.05×未落 | 核对记录：现状 `band-near`=双环 box-shadow（`css/town.css:223-227`，P-D2「近=双环」口径已落）；图标 1.05× 放大未实现——**不改**（PO 条款 6） | 转录归档 |
| T-UI-04 F5 | praise 句可能被 1.2s dwell 截断 | **确认截断→消解**：dwell 默认取 praiseTotalMs[1]（§6.2，红锚转绿） | ✅ 销号 |
| T-UI-04 F1 | 视觉值族（panel 宽/距底/底色/间距/圆角/徽章尺寸） | 核对记录归档不改（PO 条款 6：偏离清单全文在 retro-notes 条款 6，本票零视觉值改动） | 转录归档 |
| T-UI-04 F6 | ttsPlanFor/hudConvergenceFor 装配层零消费 | 终检记录（§9.2）：参数面在册+语义达成面核对+接线归 PO 批次 | 终检归档（接线不做） |
| T-UI-04 F7 | 自撰话术批（含标签式表扬） | **§7.1 明文导向部分=本票消解**（§10 三处改写+守门锚）；风格总体裁决仍归 PO 条款 7（greet chip 语义重复等非 §7.1 项不动） | 部分销号/部分转录 |
| T-UI-04F N1 | tieTask best.id 无 typeof 防御（实际不可达） | 补齐+红锚转绿（§11 #2）；真清单不可达性质在注释留痕 | ✅ 销号 |
| 03F/04F | 装具收紧标准面+S-1 removeChild 的浏览器形态（机械等价证据） | 归档：装具 children=live 只读集合视图（length/整数索引/item/迭代器，无 pop/push 变更法，removeChild NotFoundError——`test/town-ui.test.js:60-128` 与 `js/town-ui.js:100-141` **同构双面**）；生产 `clearChildren`=while+removeChild 标准面（`js/town-ui.js:616-618`）；源文本守门「children 无数组方法直调」（`test/town-ui.test.js:1615`）——装具面与真实 DOM HTMLCollection 契约同构在册 | 归档（真浏览器人工复核见 §13） |
| T-UI-03 | HL_AIM 两键施工裁量 | 依据链全文转录参数总表 §8.6（PO 条款 3） | 转录 |
| 本票新增 | 触发播报「我们去小镇啦！」未接线 | §A.4 兜底方案成立（到达播报已落）；接线=增强项 | 登记（PO 批次） |
| 本票新增 | B.4 近前话术主案未接线（east hint 恒 null 静默，`js/adventure-core.js:851-852`） | 开放态近前引导话术=增强项（「前面就是小镇啦！」话术文本已在 spec §B.4 备好） | 登记（PO 批次） |
| 本票新增 | banner 现值 vs §A.7 主案副语差异 | 现值锁（测试注明「文案终稿, ui-designer」）在先、spec 主案在后——归 PO 裁决 | 登记（本票不改） |

---

## 13. 待 PO 实机验收人工项清单（机械等价证据已归档，真机不虚勾）

1. **主路径全链真浏览器录屏**（六段连走：home→主路尽头→白闪→地标→提示→对话；无键盘输入记录）。
2. **白闪过场体感**（0.8s 双段：同步重建是否露中间态/掉帧——若露→§A.2 满格停留窗延长预案启用，调参落点已登记）。
3. **触发播报接线决策**（「我们去小镇啦！」双播报主案 vs 兜底只保留到达——§A.4 授权 PO 选）。
4. **近前话术接线决策**（B.4 主案「前面就是小镇啦！」）。
5. **镇名牌 banner 文案终值**（现值锁 vs §A.7 主案，含副语「广场真热闹/随便逛逛吧/暖洋洋的午后」三选）。
6. **告示牌牌面图案读法**（拼块无字→钟塔意象图案 UI-01 资产票排期决策+实机互文核对）。
7. **步行段引导体感**（东带①②③分级+「广场→东带」中段；不足则路标色块增强项）。
8. **praise dwell 2000ms 听感**（表扬句完整可听+不拖沓）。
9. **chip/ghost 实机点选手感**（64/44 热区+相邻间距误触率）。
10. **TTS 发音与静音链**（B4 遵循系统静音的实机核验）。
11. **会话面板遮挡实机核对**（上半屏 ≥55% 世界可见+B1 底部居中避让；F1 视觉值族偏离随条款 6 一并实机复核）。
12. **回程线实机**（z132 带式触发防误触体感+「回到家啦」落地朝西回望剪影）。

---

## 14. 登记事项 / 偏离 / 遗留风险

- **授权域解释性延伸 1 项**：PANEL_BODY.praise（面板显文）随 dialogUtterFor 一并按 §7.1 禁例改写——票面禁例词「你真棒」的在库唯一显文落点即此处；提请 PO 复核（§10）。
- **票外发现（不扩票，转录 PO）**：banner 副语差异（§12 末行）；触发播报/近前话术未接线（增强项）；「到沙漠啦」式到达句式中 `row.name` 派生口径在 map 分支仍活跃（`js/modes/adventure.js:2740`，town 分支分支内定值不受影响——零动作核对记录）。
- **遗留风险**：① 2000ms dwell 在慢语速 TTS 环境仍可能掐尾（§A.4 双播报叠加防护/兜底口径同样适用时再议，PO 实机听感后裁）；② E2E 全链为 vm 机械等价证据，真浏览器装配面依赖 §13 人工项兜底（历史教训 #11：Node 全绿≠浏览器装配绿——装具镜像守门已在册降低该风险）。
- **零触碰核对**：GLOSSARY/docs 设计权威只读（本文档为产出件非设计权威改动）；既有断言零触碰（红锚纯追加 +19/+17/+22 零删除）；禁碰五文件零 hunk。

（走查清单文档结束）
