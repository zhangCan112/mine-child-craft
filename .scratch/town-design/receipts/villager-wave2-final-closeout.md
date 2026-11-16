# villager-wave2 终局收口回执（全批：三票+案①②④修复批+idle 批+ADR-0012）

- 日期：2026-11-16 · 收口：engineer-manager（eng2-villager 接棒线）
- 派令方：scrum-vw2 · 性质：PO 实拍批次告一段落，停工转收口（收口令七件全办结）

> 〔2026-11-16 撞号改号注记〕本文历史性提及的 ADR-0012=镇昼夜解冻 ADR，现编号 **ADR-0017**（docs/adr/0017-town-day-cycle-unfreeze.md，原编号 0012 因与滑翔翼 ADR 0012 撞号让位，滑翔翼群 0012–0016 在先不动）；文中 @hash 等历史提法按当期编号留档不改。

## 1. 全批谱系（集成 → main 双段）

**集成段（villager-wave2 分支，基点 main@3f6a96d）**：
- T-NPC-10/11/12 三票 @`807555f` 收口（双轴过审）
- seamfix（t-npc-11-seamfix：greet/care 误路由修复，导出面一项放行判例）
- idle 批（po-idle-fix：方案A 完整版 ×14 实体）
- PO 验收修复批：案①②④红绿六段 @`4a65710`，并入 @`a36e627`（冲突 2 处并集解）
- 装具修复 @`8e3eafd` → 工件入库 @`0cbd411`/`63ac879` → **PO 亲落 @`9989491`**（8091 复核回执）→ ADR-0012 @`3811777`

**main 段（本线收口 commit 链）**：
| commit | 内容 |
|---|---|
| `4c3ff9f` | 并版①：villager-wave2 @9989491 并回 main（--no-ff 零冲突） |
| `529b502` | 并版收口回执（终门亲测见 §2） |
| `87b0a50` | 并版②：villager-wave2 @3811777（ADR-0012）并回 main |
| `ab461bf` | 收口入库：设计线件二产出（对话卡重设计提案）+ T-NPC-13 拍板投递件 |
| `1913a97` | 收口注记：T-NPC-13 中止留档 + README 状态列 + 三占位票行 |

**main 终态 HEAD = `1913a97`**。

## 2. 终门与 PO 门

- **终门亲测（main @529b502 时点全量）**：`npm test` 2192 测 / 2191 过 / 0 红 / 1 skip（174s，与集成侧前任亲测恰合零漂移）+ `npm run lint` 三关零错
- 其后四笔收口 commit（87b0a50→1913a97）全部 **docs-only 零代码**，测试面不变
- **PO 门**：工程线自裁通过（PO 明示授权「按你最好的判断」，案①②④全过+整体收口过）+ **PO 8091 实屏复核五条全过**（@9989491 回执 po-recheck-closeout.md）
- PO 手笔文件（js/daily-budget.js、js/modes/focus.js）全程未触碰

## 3. 停工留档（T-NPC-13）

- **未动工零 commit**：红方开工前核查完毕即接停工令（worktree/独立装具/图谱/票面三件读毕），零红测落盘、零源码施工、绿方未派发
- 断点核查三结论已转记票面（施工留档注记段）：①「G01 木头桩红测现任在库」核实为伪（续工缺则自写）；②两处源切片 gate（town-npc-idle.test.js:698 / adventure-mode.test.js:5331）推进者上链后其一必红；③装具 eng 域无 kit/THREE，傀儡面红测循 idle 先例注假行
- 清理实证：worktree t-npc-13 + 分支 t-npc-13-behavior 已删（`Deleted branch t-npc-13-behavior (was 9989491)`——零独有 commit 零损失；node_modules 真目录非 junction，删前核查）

## 4. 留票清单与下次开工顺序（排期权归 scrum，此为依赖事实+建议）

| 序 | 票 | 依赖 | 说明 |
|---|---|---|---|
| 1 | T-NPC-14 昼夜机制票 | ADR-0012 PO 待拍点终拍（PO 手里） | 立票入口：docs/adr/0017-town-day-cycle-unfreeze.md 六面方案+待拍点清单；c2 面随此票解冻 |
| 2 | T-NPC-13 a2+走摆面续工 | 无硬阻塞（断点结论在票面） | 建议：随 T-NPC-14 之后或并行排——两票均翻动 adventure.js 热文件，避免双线同窗 |
| 3 | T-NPC-15 镇夜间氛围票（light 线） | T-NPC-14 落地 | 占位在册 |
| 4 | 案⑤ 对话卡视觉票 | PO 选型（proposals 已入库 ab461bf） | 占位在册 |

## 5. 残留与边界

- 主仓 untracked 仅剩 `.scratch/town-east-boundary/arch-town-side-gate-and-edge-fence.md`（他线工件，收口令明示勿动，原状保留）
- 集成 worktree villager-wave2 与其分支保留（3811777 与 main 同源，后续线可复用或 scrum 指示处置）
- 本线 relay（eng2-villager）随收口 close_line 退场

**villager-wave2 全批终局收口。** 下次开工请 scrum 依 §4 排期派令。
