# T-NPC-14 镇昼夜解冻施工票（ADR-0017 §6 拆票表 T-DAY-01 面 · 终名落此）

> 波次：**三+**（本票落地即解锁 T-NPC-13 c2 面与 T-NPC-15/T-LIGHT；light 线另票另派，见 §7）
> blocking edges：**无硬边**——ADR-0017 决策 7 PO 终拍 2026-11-16 实答齐备（P1–P6 全按推荐/确认通过、无否决项），本票即 frontier。
> 票名口径：ADR-0017 §6/决策 1/决策 5 所称「**T-DAY-01**」=本票建议名，**终名 T-NPC-14**（ADR 原文「终名归需求线」；台账 T-LIGHT↔T-NPC-15 同款映射先例）。全文检索 T-DAY-01 命中本票即为同一票。
> 权威输入：`docs/adr/0017-town-day-cycle-unfreeze.md`（决策 1/2/3/4/5 为技术权威；状态行与 §7 表末列=PO 拍板记录，2026-11-16 回填）。
> ⚠ **本线只立票不施工**：派工与施工排期（a2+b1 收口后串行 vs 另开 worktree 并行）归 scrum 终裁，票面只注记冲突面（§6）。

## 1. 目标

镇维度解冻昼夜循环（PO 亲裁③推翻 ADR-0011 决策 1 恒白天）——「天黑=村民要回家」的可见因果，为 T-NPC-13 c2 日程时间轴供真实时间源：

1. **town 行 dayCycle 翻正**：`js/adventure-dims-core.js` town 行 `dayCycle:false → true` + 行注释改写（恒白天→随世界钟昼夜）；nether/den 行**不动**（恒暗观感来自行上暗 sky 参，口径不变，ADR §2-2 隔离确认）。
2. **行 sky.color 经 setSkyBase 改道白日端点**：循环维度的行色必须走天基色缝（`setSkyBase` 只换昼侧锚点），否则每 50 tick 被 applyDaylight 覆写回主世界端点（ADR §2-4）；夜侧端点=Daylight 折线自带月光蓝/深夜蓝，**无新行字段**。
3. **advSetDim 分支内 applyDaylight 一拍**：维度分支对 `drow.dayCycle === true` 的行补切界序（§4 定死），白闪遮罩内即完成首帧正确；同时消除 §2-5 冻结遗留态家族（天体/云可见性、uDim/uSkyFloor 材质暗档随链路复活自然消解）——**无需独立修复票**。
4. **P1 拍板=基底 0.75 零参数化**：applyDaylight 硬编码（sun 0.75 / ambient 0.65）**不动**、`js/world.js` **零改**——行 sky.sunI 0.92 降为首帧初值，循环接管后正午平行光=0.75（与主世界图一致）；PO 实屏后验可调，调则参数级补票另呈，本票不预缝。
5. **回程端点复位零新工**：overworld 分支 `advApplyMapPalette` 与 cleanup `advMapRowCleanup` 既有链自动恢复（:2471/:4806），不写新复位代码。

## 2. 拍板边界（PO 终拍 2026-11-16，权威=ADR §7 表末列；施工方勿重问 PO）

| 点 | 拍板 | 票面落地含义 |
|---|---|---|
| P1 正午平行光基底 | **0.75 标准** | applyDaylight 硬编码不动、world.js 零改（本票文件域不含 world.js 的拍板依据） |
| P2 夜间观感中间态 | **接受月光小镇先行** | 机制票不等氛围票：本票先落，灯柱/窗光/夜端点暖化全归 T-NPC-15（T-LIGHT）后调 |
| P3 镇内恒无怪 | **维持** | 零代码——门禁是维度判据非光照判据（ADR §2-6），本票不触任何刷怪路径 |
| P4 镇 BGM | **恒 calm** | 零改动——advMusicMood 维度行锁 mood 现状保持 |
| P5 镇 HUD | **安静档不加时段行** | 零改动——TIDEA-12 安静档维持 |
| P6 知会项 | **接受** | 镇内时间照推世界钟，离镇可能入夜=既有 home 夜怪机制；首版不做「出镇保温」（挡回域） |

时间源口径（ADR 决策 4，只定缝）：全局 dayTime 单钟，不建镇独立钟/不缩放；时段枚举=Daylight.clockPhase 四段现成（零新枚举）；一日 24000 tick=20 分钟实时、夜段≈7.2 分钟。**日程本体（消费这口钟）归 T-NPC-13 c2，本票不写日程逻辑。**

## 3. 文件域（README §6 规约逐条回应）

### 3.1 §6 固定问句（债 3）：「本票是否有生成器/导出器会再生成既有产物？」

**无。** 本票文件域全为源码直改与手写文档修订；`.scratch/town-design/gen/` 导出链、`test/fixtures/town-npc-golden.json`、mob-look 档案零关联。

### 3.2 基线文件域

| 文件 | 动作 | 说明 |
|---|---|---|
| `js/adventure-dims-core.js` | 改 | town 行（:732 附近）`dayCycle:false→true` + 行注释改写；**nether/den 行（:706/:719）与 ADV_TOWN 结构常量零连带**（ADR 决策 1 逐字段对照表为权威口径） |
| `js/modes/adventure.js` | 改 | advSetDim 维度分支（:2395-2483 段）循环行 setSkyBase 改道 + 分支内 applyDaylight 一拍（对齐 overworld 分支 :2471-2473 序）；**热文件：与 T-NPC-13 a2+b1 面同文件不同段**（§6 排期注记） |
| `test/adventure-dims-core.test.js` | 改 | :198 行值锚 `dayCycle:false` 断言翻正（红→绿翻钉） |
| `test/adventure-mode.test.js` | 改 | :4815「镇内昼夜冻结」断言与 :4827 回 home 断言翻新（**值不变、文案随语义改写**）；:762-771 init/cleanup 昼夜断言**不动** |
| `docs/town-map-design.md` | 改 | §6.3.3 行规格表逐字段修订（勿另起炉灶，ADR 决策 1 表为口径）+ §6.3.4 昼夜配合段改写（「镇内时间冻结不推进主世界昼夜」语义反转）+ :168 主态注记同步 + §6.3.6 取代记录加行（ADR-0011→ADR-0017 修订链） |
| `GLOSSARY.md` | 改 | 「小镇维度」词条改写（恒白天→随世界钟昼夜） |
| 本票面 + `tickets/README.md` | 改 | 施工记录回填 + 台账状态列 |

**红线（不在文件域=结构保证）**：`js/world.js` 零改（P1 拍板）· `js/main.js` 零改（主循环 :400-403 现成即用）· index.html / js/town.js / js/mode-registry.js 禁触（README §2）· 光照 Worker 协议与节拍钉零牵动（ADR §2-9）· 镇无床语义/建场词表不触（ADR §2-2）。

### 3.3 规范回写义务（README §6 债 5 条款）

- 本票改 GLOSSARY「小镇维度」词条 → 「GLOSSARY 对应表述回写」已列文件域（conventions.md 相关表述若随语义反转需同步，同票核实回写）；词条计数勿手数，收尾跑 `node --test test/conventions.test.js` 的 GLOSSARY 断言验平（2026-11-14 起在库）。
- 钉测翻钉三处（:198/:4815/:4827）属行为断言改源——测试是事实权威，正文（town-map-design §6.3.3/§6.3.4/:168）必须同票回写，**两改同收口不许拆期**（判例：T-NPC-01/03 两轮改源后规范滞后的 retro 债 5）。

## 4. 接口形状（切界序定死，ADR 决策 1 施工口径）

- **定死不重开**：维度分支对 `drow.dayCycle === true` 行的切界序 = `setSkyBase(行色转 [r,g,b]) → advApplySky(行参=雾距+初值) → dayCycleOn=true → applyDaylight()` 一次——四步顺序对齐 overworld 分支现序。hex→[r,g,b] 换算等实现细节施工方裁。
- **雾距不动**：sky.fogNear/fogFar 75/200 走 advApplySky 直写保留（applyDaylight 无雾距写点，ADR §2-4；:2005-2011 私产口径先例）。
- **零连带面**：mood/build/spawn/hud/assets 全不动（昼夜不碰建场/落点/安静档 HUD/showMobs:false）；ADV_TOWN 结构常量纯坐标派生零连带；nether/den/overworld 全链不触。
- **时间源只读**：本票只把 dayCycleOn 闸打开，dayTime 推进与持久化走既有链（main.js:400-403 + WorldJournal 六键含 dayTime），零新存档字段、零新枚举。

## 5. 验收标准（红绿面，ADR §6 验收锚逐条）

### 5.1 绿（验收锚）

1. **进镇日/夜两态天色端点正确**：白日=暖亮端点（行色经 setSkyBase 落昼侧锚点）、夜=月光蓝（Daylight 折线自带夜侧端点）。
2. **回 home 端点自动复位**：出镇回主世界天色链零残留（既有 advApplyMapPalette / advMapRowCleanup 链承担，:4827 钉值不变文案改写）。
3. **天体/云随昼夜走，冻结遗留态消除**：进镇后天体/云不再冻结在上一场遗留态；「黄昏进镇→方块带暗档、天却亮白」的材质软破随之消失（ADR §2-5 家族）。
4. **镇内恒无怪回归钉全绿**：维度门禁链（adventure.js:4890-4904）零牵动实证——夜怪节拍/巢穴节律/涌出/牧场/繁育/灯笼政策全链断言原样通过。
5. **world-vertexlight 两钉零漂移**：test/world-vertexlight.test.js:281（applyDaylight 节拍钉）与 :349（serveChunkKey Worker 协议钉）原样通过。

### 5.2 红绿循环锚

- **红（立票日现状）**：:198 行值锚 `dayCycle:false` 断言为真、:4815「镇内昼夜冻结」断言为真——本票翻正后两红转绿；:4827 值不变、文案改写。
- **绿（收口）**：翻钉三处全绿 + §5.1 五锚全绿。

### 5.3 收尾义务

- `npm test` 当值全量 0 红 + `npm run lint` 三关零错（工程线 a2+b1 若已上链，以当值基线为准，勿引立票日数字）。
- §3.3 规范回写兑现 + `node --test test/conventions.test.js` 验平。
- 提交纪律：conventions.md §7 Windows 纪律拆单条 commit，只 `git add` 本票文件域文件（同树并行线的未提交改动勿裹挟）。

## 6. 施工排期注记（终裁归 scrum，票面只如实注记冲突面）

- **同文件不同段**：本票动 advSetDim 段（adventure.js :2395-2483）+ dims-core town 行；T-NPC-13 a2+b1 面（已开工）动 update 镇民段——冲突面=同两文件的不同函数段，行级互斥面小。
- **ADR §6 原排序已失效**：「T-DAY-01 先行降冲突面」的前提（a2+b1 未开工）已不成立。a2+b1 收口后串行 vs 另开 worktree 并行，**由 scrum 派施工票时终裁**，本票不预设。
- 若另开 worktree：按 docs/worktree-pitfalls.md 独立 `npm install --ignore-scripts --strict-ssl=false`（禁 junction）、删树前 `cmd /c rmdir` 摘链接、删后 `session_move` 回主仓。

## 7. 波次注记

- **本票落地解锁**：
  - **T-NPC-13 c2 面**（13 单航点扩多航点日程 + 日程时钟消费）——其硬边「ADR-0017 决策 7 终拍 + T-DAY-01 落地」随本票销号（终拍已销一半，本票销另一半）；「傍晚钟塔停驻」预留指针自本票落地起激活。
  - **T-NPC-15 镇夜间氛围**（ADR §6 所称 T-LIGHT，light 线**另票另派**）——依赖本票「对着真夜调参」；含灯柱/窗光/（可选）夜端点暖化缝，视觉方案由 light 线出，届时另呈不夹带。
- **首版明确不含（防夹带清单，ADR §挡回域）**：夜间美术件全归 T-NPC-15；夜端点暖化缝 / 保 0.92 缝加宽 / 夜间换曲 / 时段行 =「不挡回也不随票夹带」届时另呈；「出镇保温」挡回（P6 知会已接受）；镇独立时钟 / 时间缩放挡回；镇夜间刷怪挡回。

## 8. 施工记录（参照 T-NPC-13 票面 §11 格式：红相/绿相/裁决记录）

### 8.1 红相落盘清单（2026-11-16，红方 ses 本岗；分支 `t-npc-14-day-cycle` @e97b235 起）

| 文件 | 动作 | 内容 |
|---|---|---|
| `test/adventure-dims-core.test.js` | 改（钉翻新 ×4） | ① :192 测题「恒白天」→「随世界钟昼夜」（同钉语义翻新）；② **:198 行值锚 `dayCycle:false→true` + 文案随 ADR-0017 决策 1 改写（主红钉）**；③ :94 全行「恒停昼夜」循环断言——town 豁免（值单份权威归 :198 值锚），nether/den 恒停钉**原样保留**（票面钉清单漏列的第四处结构性钉，红方裁决补翻，见 8.3-1）；④ :135 advMusicMood('town', true) 断言**值不变**（P4 恒 calm）、文案「dayCycle 冻结, 恒白天」→「P4 拍板: 维度行锁 mood, 昼夜不变曲」 |
| `test/adventure-mode.test.js` | 改（钉翻新 ×2） | ① **:4862「镇内昼夜冻结」`dayCycleOn:false→true` + 文案随语义翻新（主红钉）**；② :4874 回 home 断言**值不变（true）**、文案「镇内时间冻结不外溢」→「镇内时间随世界钟, 回程端点既有链自动复位零残留」；:807-827 昼夜 D1 init/cleanup 断言**零触碰**（票面红线） |

行号漂移注记：票面 §3.2/§5.2 所记 :4815/:4827 系立票日行号，T-NPC-13 上链后实漂至 :4862/:4874（语义定位不受影响，按票面语义 grep 锚定）。

### 8.2 红基线自证（翻钉后、实现前；红因按 conventions §7.4 以日志实读归因）

| 命令 | 结果 | 红因 |
|---|---|---|
| `node --test test/adventure-dims-core.test.js` | 27 测 / 26 过 / **1 红** | AssertionError @:198 town 行值锚「dayCycle:true=随世界钟昼夜…」（断言红非装具炸） |
| `node --test test/adventure-mode.test.js` | 245 测 / 244 过 / **1 红** | AssertionError @:4862 T-SEAM-03「镇内昼夜解冻…」（断言红非装具炸） |

其余全绿零扰动实证：:94 修后 nether/den 恒停钉绿；:135 值不变钉绿；:807-827 init/cleanup 昼夜钉绿；红面恰 2 处主钉，零杂散红。

### 8.3 红方裁决记录（随票面归档；绿方签名与行为以下列为准）

1. **:94 结构钉补翻裁决**：票面红面清单只列 :198/:4815/:4827 三处，实查发现 :94「三行恒停昼夜」循环断言与翻正后 town 行结构性互斥（不补翻则绿相必红、票面 §5.1 无法满足）。裁决：按 ADR-0017 决策 1 权威豁免 town（town 值单份权威归 :198 值锚测，不在循环断言里复制第二份），nether/den 恒停钉原样保留。不打回需求线理由：ADR 权威明确无歧义、修法机械、该测试文件本就在票面 §3.2 文件域内。
2. **:135 文案刷新裁决**：值不变（P4 终拍恒 calm），仅文案陈旧语义（「dayCycle 冻结, 恒白天」）随解冻反转刷新，文案新据=P4 拍板口径。零红影响（翻钉后该钉即绿）。
3. **行号漂移裁决**：钉位以语义定位为准（见 8.1 漂移注记），票面行号不回改（立票日史料）。
4. **红面纪律自证**：未写票文外新测试；全部测试改动均为既有钉的翻值/豁免/文案刷新，断言语义逐条对得上 ADR-0017 决策 1 与票面 §5。

### 8.4 绿相施工域指针（§3.2 文件域内，红钉已全数钉形；绿方**不得改任何测试**，测试争议回红方裁决）

- `js/adventure-dims-core.js`：town 行（:724-738 段）`dayCycle: false → true` + 行注释改写（恒白天→随世界钟昼夜，ADR-0017 决策 1 口径）；**nether（:706）/den（:719）行与 ADV_TOWN 结构常量零触碰**。
- `js/modes/adventure.js`：advSetDim 维度分支（现址 :2487-2488 `advApplySky(drow.sky); dayCycleOn = drow.dayCycle;` 两行处）——对 `drow.dayCycle === true` 行落**票面 §4 定死切界序四步**：`setSkyBase(行色 hex→[r,g,b] 0..1)` → `advApplySky(drow.sky)`（雾距 75/200 私产直写+首帧初值）→ `dayCycleOn = true` → `applyDaylight()` 一次（对齐 overworld 分支 :2519-2521 现序）；`setSkyBase` 须 `typeof` 守卫（mode 测试装具无 world.js，advEdgeSkyTick :2067 先例）；非循环行走现径零改。**热文件红线（零触碰，diff 自证点）**：advTownPatrolTick/advTownPatrolApply（:3241/:3254）、update 调用点（:5374/:5383）、导出挂点（:5652/:5654）。
- `docs/town-map-design.md`：§6.3.3 行规格表（:294-303）逐字段修订（**ADR-0017 决策 1 对照表为口径勿另起炉灶**：dayCycle/sky.color/sky.sunI 三行更新，spawn/hud/assets/mood/build 零牵动）+ §6.3.4 昼夜配合段（:336-337）语义反转改写 + :168 主态注记同步 + §6.3.6（:377-383）取代记录加行（ADR-0011→ADR-0017 修订链）。
- `GLOSSARY.md`：「小镇维度」词条（:477-479）改写——恒白天（dayCycle:false+暖亮 sky 参）→随世界钟昼夜（dayCycle:true，白日端点经 setSkyBase 落行色、夜侧=Daylight 折线月光蓝；无怪/恒 calm/白闪进出语义不变）；**只改写不增删词条**（计数勿手数，收尾 `node --test test/conventions.test.js` GLOSSARY 断言验平=T-NPC-13 后的 69）。
- 本票面 §8.5 回填 + `tickets/README.md` 台账**只动 T-NPC-14 行**（状态「已立票（待派工）」→施工完成口径，参照 T-NPC-13 行格式）。

### 8.5 绿相施工记录（2026-11-16，绿相收口）

**绿相交付**（implement-engineer 施工；工作树**全绿未提交态**交回，提交归红方验收后单条执行——Windows 纪律 §7.3）：改动面恰四文件零夹带——

1. `js/adventure-dims-core.js`：town 行 `dayCycle:false→true` + 行注释改写（ADR-0017 决策 1 口径：随世界钟昼夜——时间随全局 dayTime 单钟推进+天体/云解隐+uDim/uSkyFloor 真实调暗；白日端点经 setSkyBase 落行色；sunI 0.92 降为首帧初值 P1 拍板）；行头权威引用补「昼夜解冻 ADR 0012」；**nether/den 行与 ADV_TOWN 结构常量零触碰**（diff 实证：改动全落在 town 行段内）。
2. `js/modes/adventure.js`：advSetDim 维度分支（现址 :2487）循环行**定死切界序四步**——`setSkyBase(advEdgeRgb(drow.sky.color)) → advApplySky(drow.sky) → dayCycleOn=true → applyDaylight()` 一次（对齐 overworld 回界分支现序 :2533-2535 现址）；`setSkyBase` **typeof 守卫**（mode 装具无 world.js，advEdgeSkyTick :2067 先例）；hex→[r,g,b] **复用 adventure-core 现成助手 `advEdgeRgb`**（浏览器 index.html :365→:400 加载序与 mode 装具 :402 `Object.assign(globalThis, AdventureCore)` 双侧可达，零新装具零新助手）；非循环行走 else 分支原两行原样（nether/den 现径零改）。**diff 恰一 hunk（@@ 首行 `function advSetDim` 函数内）**——热文件红线段（advTownPatrolTick/advTownPatrolApply、update 调用点、导出挂点）零触碰实证：`git diff js/modes/adventure.js | grep advTownPatrol` 零命中。
3. `docs/town-map-design.md` 四处同收口（两改同收口不拆期）：§5.2 :168 主态注记语义反转（2026-11-13 注记→2026-11-16 再变更链）；§6.3.3 行规格表 sky/dayCycle 两行逐字段修订（**ADR-0017 决策 1 对照表为口径**：sky.color 经 setSkyBase 落白日端点/fog 75/200 不变/sunI 首帧初值/dayCycle true 语义；mood/build/spawn/hud/assets 行零牵动）；§6.3.4 昼夜配合段语义反转（镇内时间照推主世界昼夜+四步切界序+回程端点既有链复位零残留+P6 离镇入夜知会+恒无怪维持）；§6.3.6 取代记录**加行 4**（ADR-0011 决策 1→ADR-0017 修订链）。
4. `GLOSSARY.md`：「小镇维度」词条正文改写（恒白天→随世界钟昼夜，含 setSkyBase 落行色/Daylight 折线夜侧月光蓝口径；权威引用补 ADR-0017）。**只改写不增删**自证：diff 恰 2 行（同条正文 1 删 1 增），词条头行与一览行零出现，`node --test test/conventions.test.js` GLOSSARY 确定性断言绿=declared=实际机械验平。

**终值（当值全量 gates，非转抄亲验）**：

| 命令 | 结果 |
|---|---|
| `node --test test/adventure-dims-core.test.js` | 27 测 / 27 过 / **0 红**（红钉① @:201 town 行值锚转绿） |
| `node --test test/adventure-mode.test.js` | 245 测 / 245 过 / **0 红**（红钉② @:4862 昼夜解冻转绿） |
| `npm test` | **2292 测 / 2291 过 / 0 红 / 1 skip**（与 T-NPC-13 收口基线同形；T11 沙漠铺怪间歇债本轮未现红，零误伤零顺手修） |
| `npm run lint` | 三关零错（eslint + stylelint + htmlhint，exit 0；js 侧改动文件 eslint 单跑亦 0 错） |
| `node --test test/conventions.test.js` | 13 测 / 13 过 / 0 红（GLOSSARY 计数验平） |
| `node --test test/world-vertexlight.test.js` | 7 测 / 7 过 / 0 红（§5.1-5 两钉零漂移：applyDaylight 节拍钉 :281 + serveChunkKey Worker 协议钉 :349） |

**验收锚 §5.1 兑现**：锚 1 日/夜两端点（行色经 setSkyBase 落昼侧锚点 :2493+Daylight 折线夜侧月光蓝 :2498——机制面绿；PO 实屏观感终验归上游排期）；锚 2 回 home 端点复位（既有链零新工，:4874 钉值 true 绿）；锚 3 冻结遗留态消解（分支内 applyDaylight 一拍，天体/云/uDim 随链复活——ADR §2-5 家族）；锚 4 镇内恒无怪回归钉（维度门禁链零牵动——adventure-mode 245 全绿含夜怪节拍/巢穴节律/涌出/牧场/繁育全链断言）；锚 5 world-vertexlight 两钉（7/7 绿）。**零夹带五挡回实证**：`git status --porcelain js/world.js js/main.js index.html js/town.js js/mode-registry.js` 空输出=零改动；nether/den 行、ADV_TOWN、mood/build/spawn/hud/assets 面 diff 零命中。

**绿方争议/缺口申报**：无——红钉两处按 §8.4 施工域逐字落地，测试文件零改动（红方两测试文件原样保留、未 stage 未 commit），零裁决回请。
