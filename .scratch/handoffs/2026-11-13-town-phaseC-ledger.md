# town-design Phase C 票据台账（engineer-manager 维护）

> 环境：worktree C:\Users\user\.local\share\opencode\worktree\1631a8\town-design · 分支 town-design
> 票表权威：docs/town-architecture-design.md §11
> 记录日期：2026-11-13

## 票据状态

| 票 | 状态 | 主/执行 | 回执/证据 |
|---|---|---|---|
| T-PREFAB-01 tower-belfry | 施工中（测试 26/26 绿，待票主验收+提交+回执） | tdd-engineer ses_e2fca882bffej1jJezdNH023c8（绿方主内派发） | 已催收（2026-11-13） |
| T-PREFAB-02..08 | 未派（串行等 01 收口：同文件 js/prefab-kit.js / test/prefab-kit.test.js） | — | — |
| T-PREFAB-09 复用行校验 | 未派（依赖 01..07） | — | — |
| T-MAP-01..04 | 阻塞（依赖 prefab 线） | — | — |
| T-UI-00 入口卡 token | **已收口 ✅（2026-11-13 本岗验收通过）** | PO→scrum-master 安排；ui-designer ses_e2f96f8dfffevaYWQWoz2NB45z 执行；analyst-manager 需求线审核 | commit d412cff；回执 .scratch/handoffs/2026-11-12-T-UI-00-receipt.md（已归档提交）；验收依据=派单 brief 验收项齐备（路径/对齐说明/lint/conventions/commit），conventions 既有失败与本票无关且已由本岗修复 |
| T-UI-01..05 | 阻塞（T-MAP-02 等；ui-designer 路标票按 PO 指示走提票→scrum-master 安排线） | — | — |

## 环境事件与处理

- 2026-11-12：subagent(architect) 权限被拒 → ask_user → 用户修复后重试成功。
- 2026-11-12：subagent(ui-designer) 权限被拒 → ask_user → PO 拍板「提票出来，scrum-master 安排」→ UI 线改走派单 brief（.scratch/handoffs/2026-11-12-T-UI-00-dispatch-brief.md，commit 573668f）。
- 2026-11-12：PO 过目架构（ask_user 900s）超时 → 按预批 A→B→C 落默认记录继续（.scratch/handoffs/2026-11-12-town-phaseB-po-timeout.md）。
- 2026-11-13：Phase A 文档文本卫生修复（commit 045f167）：town-prefab-specs.md 补收尾换行（基线 d0a2725 即缺）、town-ui-dialog-spec.md 统一 LF；minecraft-movie-town-research.md 为检出态 CRLF（blob 本就 LF，工作区对齐即消，无需提交）。conventions.test.js 9/9 绿。**retro 候选：Phase A 文档提交未跑 npm test（conventions 门禁本可拦住）。**

## 流程口径（本批）

- prefab 线：一票一收口串行（同文件冲突 + 全量测试证据纯净性），收口顺序 T-PREFAB-01→02→…→09。
- UI 线：ui-designer 路标票由本岗提派单 brief → PO 转 scrum-master 安排 → 回执归本岗验收收口；「ui-designer 走查记录」验收项在实现票阶段由 PO 验收时履行或另行安排。
- 每票收口：证据（红测清单/转绿轨迹/裁决/lint+test/commit）齐备才并入；reviewer 评审在代码票收口后进行（docs-only 票以确定性门禁+需求线审核等效覆盖）。
