# T-TEST-T14 镇天缝覆盖钉 test-only 小票（advSetDim 循环行分支「setSkyBase 改道 + applyDaylight 首拍」钉测）

> 波次：**三+（test-only 覆盖钉债票）**
> blocking edges：**无硬边**（不依赖任何未收口票）。唯一冲突面=施工排期：与 T-TEST-T11 / T-UI-DLG-01 同文件相邻作业，串行队列 T11 → 本票 → T-UI-DLG-01（§6），终裁归 scrum。
> 票名口径：票名中「T14」承接 T-NPC-14 票号（镇昼夜解冻施工票，被测四步切界序的施工出处），本票是其覆盖钉债票，非施工面翻新票、与其票系无隶属换算；与 T-TEST-T11 同款防检索混串注记（T-NPC-14 票名别名注记同款先例）。
> 证据底座：T-NPC-14 票面 §8.5（绿相四步切界序自证）+ 合并预告自证（engmgr-vw3-2 群内 2026-11-16，非阻塞观察项；scrum 终裁补钉 2026-11-16）+ ADR-0017 决策 1（行色必经 setSkyBase 改道口径权威）。
> ⚠ **test-only 票：文件域唯一 `test/adventure-mode.test.js`，生产代码（`js/` 全域）零改**。派工与施工排期归 scrum，票面只如实注记冲突面（§6）。

## 1. 目标与事实底座

给 T-NPC-14 落地的 advSetDim 循环行分支四步切界序补 CI 直接钉：「setSkyBase 改道调用（实参=行色端点）」与「分支内 applyDaylight 恰一次（首拍）」，使 ADR-0017 决策 1 施工口径的回归由全量门捕捉，不再只靠 PO 实屏肉眼兜底。

- **缝隙成因（立票日 @8451960 树核实）**：生产切界序在 `js/modes/adventure.js:2487-2498`——`if (drow.dayCycle === true)` 分支内 `typeof setSkyBase === 'function'` 守卫（:2491）→ `setSkyBase(advEdgeRgb(drow.sky.color))`（:2493，hex→[r,g,b] 0..1）→ `advApplySky(drow.sky)`（:2495，雾距私产）→ `dayCycleOn = true`（:2497）→ `applyDaylight()` 一次（:2498）。mode 测试装具无 world.js，装具面缺 `setSkyBase`，守卫静默跳过（:2491 注释自认「缺席跳过=白日端点走缺省蓝」）——进镇分支的改道与首拍在全量门零直接断言。
- **既有钉登记（本票不动它们）**：test/adventure-mode.test.js :4862「镇内昼夜解冻(dayCycle:true 随世界钟昼夜, ADR-0017 决策 1)」只钉 `dayCycleOn=true`；:4874-:4875「回 home 主世界昼夜照转」与「applyDaylight 恢复当下天色」在 overworld 回界面（且后者为 `.some()` 存在断言非计数），均非 town 分支内两拍。dims-core 侧行值锚（test/adventure-dims-core.test.js :201）钉 `dayCycle:true` 行值，不触 mode 装具缝。
- **后果面（ADR-0017 §2-4 / 决策 1）**：循环维度的行 sky.color 必经 setSkyBase 改道，否则被 applyDaylight 每 50 tick 覆写回主世界端点=天色破相；分支内首拍同时消解天体/云/uDim 冻结遗留态（ADR §2-5）。此口径是 ADR-0017 决策 1 施工口径核心——reviewer 判定为覆盖选择非票面缺口，scrum 终裁补钉（CI 捕捉优于肉眼，2026-11-16）。

## 2. 文件域（README §6 立票规约逐条回应）

| 文件 | 动作 | 说明 |
|---|---|---|
| `test/adventure-mode.test.js` | 改 | **唯一施工文件**：装具面开 `setSkyBase` 注入缝（§3）+ 两钉落位（§3）；注入方式红方裁 |

### 2.1 §6 固定问句（债 3）：「本票是否有生成器/导出器会再生成既有产物？」

**无。** 纯测试文件手改；生成器/导出链/golden fixture 零关联。

### 2.2 债 5 守门改源条款复核

**不触发。** 本票不改白名单/守门测试源（adventure-mode.test.js 为行为断言件，非 mob-look 白名单类守门），conventions/GLOSSARY 无对应表述需回写；GLOSSARY 零词条变动。收尾跑 `node --test test/conventions.test.js` 验平即可（立票日基线 13 测/13 过）。

**红线（不在文件域=结构保证）**：`js/` 全域零改（**含 `test/helpers/fake-dom.js`——mkEl 假 DOM 工厂守门执法，不可触碰**） · 其他 test 文件零改 · **断言语义零放松**（既有断言零触碰，本票只增钉） · 既有钉零漂移（:4862/:4874/:4875 及立票日基线 adventure-mode 245 测、adventure-dims-core 27 测、world-vertexlight 7 测全数原文全绿）。

**行号漂移告诫**：本文件为多票共用热测试件（T11 在途将再翻动行号），施工以断言名/描述块定位；本票钉位段=「T-SEAM-03 回程端到端…」进镇段，T11 目标段=「T11 同池回落」沙漠分支，同文件不同段互勿触碰；立票日行号仅落点参考（@8451960 树）。

## 3. 钉设要求（语义定死，落法红方裁）

票面只定两钉的验收语义；注入缝与捕获窗的具体落法（装具 globalThis 注入/测试内捕获包装/计数差分等）由红方按装具现状自裁，票面不写死。装具注入先例指针：同文件 :4875 的 `calls` 捕获阵列（`calls.some((x) => x[0] === 'applyDaylight')`）即事件捕获风格在案；装具装载规约 conventions §7.1；mkEl/fake-dom.js 纪律不动。

1. **钉 1（改道钉）**：进 town 分支时 `setSkyBase` 被调用，且实参=行色端点（语义=`advEdgeRgb(drow.sky.color)` 同源 [r,g,b] 0..1 换算；断言形状红方裁——按端点数值直断或与 `advEdgeRgb` 同源对照均可，但不得弱化为「被调用过」零参断言）。
2. **钉 2（首拍钉）**：`applyDaylight` 在进镇分支执行窗内**恰一次**（首拍语义=ADR-0017 决策 1 施工口径「分支内补昼夜首拍」；「分支内」与主循环后续每帧拍的捕获窗区分归红方，票面不写死）。

**钉有效性（红能力）**：两钉须具备红能力，恒绿假钉不予验收——钉 1 天然红（缝缺位即断言红）；钉 2 红能力自证方式红方裁（如临时致断分支调用验证即红，实验态不落盘）；红因分类留痕按 conventions §7.4（机械段实录，勿手写红因）。

## 4. 验收标准（红绿可测）

1. **两钉转绿**：§3 钉 1+钉 2 语义全数落位且绿。
2. **钉有效性自证**：两钉红能力留痕（§3；§7.4 红因分类段实录）。
3. **既有钉零漂移**：立票日基线全数原文全绿——`node --test test/adventure-mode.test.js` 245 测（含 :4862/:4874/:4875 逐字零改）、`node --test test/adventure-dims-core.test.js` 27 测、`node --test test/world-vertexlight.test.js` 7 测；施工后 adventure-mode 总数=245+新增钉数。
4. **文件域复核**：`git diff` 仅触 `test/adventure-mode.test.js`，`js/`（fake-dom.js 在内）与其他 test 零漂移。
5. `npm run lint` 三关零错；`node --test test/conventions.test.js` 13/13 验平。
6. 提交纪律：conventions §7.3 Windows 纪律拆单条 commit，只 `git add` 本票文件域文件（同树未跟踪瞬态日志勿裹挟，§7.7）。

## 5. blocking edges

**无硬边**——不依赖任何未收口票，除 §6 排期注记外立即可派。

## 6. 施工排期注记（终裁归 scrum，票面只如实注记冲突面）

- **串行队列（件七派令定，scrum 执行）**：T-TEST-T11 → 本票 → T-UI-DLG-01——test/adventure-mode.test.js 同文件相邻作业减翻动；T11 在途/落地会翻动本票落点区行号，以断言名定位。
- **与 T-TEST-T11 独立不合并**：两票同文件但考虑点不同（消红间歇债 vs 补覆盖钉），票面内容绝不合并（件七裁决在案）。
- 相对次序终裁权在 scrum，票面不写死。
- 装具 8080 撞车面同款注意（跑全量前确认无并行会话占 8080，conventions §7.3）。

## 7. 证据指针

- T-NPC-14 票面 §8.5：四步切界序绿相自证（:2491 typeof 守卫 + :2493 `setSkyBase(advEdgeRgb(drow.sky.color))` + :2495-:2498 advApplySky/dayCycleOn/applyDaylight）——缝隙事实出处。
- 合并预告自证：engmgr-vw3-2 群内 2026-11-16（villager-wave3 relay，未落盘回执件，以群记录为准）——非阻塞观察项原始出处；scrum 终裁补钉同日（件七派令）。
- ADR-0017 决策 1（`docs/adr/0017-town-day-cycle-unfreeze.md`）：行色必经 setSkyBase 改道口径权威（§2-4：直写被 applyDaylight 每 50 tick 覆写；决策 1 施工口径=四步切界序）。
- 断言锚：测试「T-SEAM-03 回程端到端: 镇内南缘越线(z≥132)白闪回 home → 落 east 锚(约 154.5,75)面朝西 …」内「镇内昼夜解冻(dayCycle:true 随世界钟昼夜, ADR-0017 决策 1)」断言（立票日 :4862，@8451960 树）。
