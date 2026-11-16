# T-NPC-14 镇昼夜解冻施工票（ADR-0012 §6 拆票表 T-DAY-01 面 · 终名落此）

> 波次：**三+**（本票落地即解锁 T-NPC-13 c2 面与 T-NPC-15/T-LIGHT；light 线另票另派，见 §7）
> blocking edges：**无硬边**——ADR-0012 决策 7 PO 终拍 2026-11-16 实答齐备（P1–P6 全按推荐/确认通过、无否决项），本票即 frontier。
> 票名口径：ADR-0012 §6/决策 1/决策 5 所称「**T-DAY-01**」=本票建议名，**终名 T-NPC-14**（ADR 原文「终名归需求线」；台账 T-LIGHT↔T-NPC-15 同款映射先例）。全文检索 T-DAY-01 命中本票即为同一票。
> 权威输入：`docs/adr/0012-town-day-cycle-unfreeze.md`（决策 1/2/3/4/5 为技术权威；状态行与 §7 表末列=PO 拍板记录，2026-11-16 回填）。
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
| `docs/town-map-design.md` | 改 | §6.3.3 行规格表逐字段修订（勿另起炉灶，ADR 决策 1 表为口径）+ §6.3.4 昼夜配合段改写（「镇内时间冻结不推进主世界昼夜」语义反转）+ :168 主态注记同步 + §6.3.6 取代记录加行（ADR-0011→ADR-0012 修订链） |
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
  - **T-NPC-13 c2 面**（13 单航点扩多航点日程 + 日程时钟消费）——其硬边「ADR-0012 决策 7 终拍 + T-DAY-01 落地」随本票销号（终拍已销一半，本票销另一半）；「傍晚钟塔停驻」预留指针自本票落地起激活。
  - **T-NPC-15 镇夜间氛围**（ADR §6 所称 T-LIGHT，light 线**另票另派**）——依赖本票「对着真夜调参」；含灯柱/窗光/（可选）夜端点暖化缝，视觉方案由 light 线出，届时另呈不夹带。
- **首版明确不含（防夹带清单，ADR §挡回域）**：夜间美术件全归 T-NPC-15；夜端点暖化缝 / 保 0.92 缝加宽 / 夜间换曲 / 时段行 =「不挡回也不随票夹带」届时另呈；「出镇保温」挡回（P6 知会已接受）；镇独立时钟 / 时间缩放挡回；镇夜间刷怪挡回。
