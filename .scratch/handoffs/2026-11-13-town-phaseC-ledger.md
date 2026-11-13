# town-design Phase C 票据台账（engineer-manager 维护）

> 环境：worktree C:\Users\user\.local\share\opencode\worktree\1631a8\town-design · 分支 town-design
> 票表权威：docs/town-architecture-design.md §11
> 记录日期：2026-11-13

## 票据状态

| 票 | 状态 | 主/执行 | 回执/证据 |
|---|---|---|---|
| T-PREFAB-01 tower-belfry | **票清 ✅（2026-11-13）** 评审有条件通过→4 修复项全落地（建议级 d535f04 + 阻塞级裁决 d92e5b7：4×4 同心登记裁决/PO-pending）；26/26+lint 绿；spec 未动（勘误挂 PO 确认） | tdd-engineer ses_e2fca882bffej1jJezdNH023c8（绿方 ses_e2fc688cdffe0ct61gSl5yUw1R） | commits：a333f8a+d535f04+d92e5b7；评审 ses_e2de26980ffeyrk6uSmG4lx4B8 |
| T-PREFAB-02 shop-awning | **票清 ✅（2026-11-13）** 一笔 d60170c（js+89/-3 · test+287/-0 纯追加，numstat 已核）；票主回执齐：六组红测自证 26/6、绿方轨迹、裁决 ff8b8d0a（doorHole 豁免=票主红笔误亲修，绿方零改测试属实）、lint 零错、全量 1790 pass/0 fail/1 skip（票外既有）；评审两轴通过零必须修，6 建议项挂账（见环境事件） | tdd-engineer ses_e2dcd1ae7ffeOK78X614rSX7Cg（绿方 ses_e2dc54e1dffehFOwvxNsmkjXzD） | commit d60170c；评审 ses_e2d81399effelRjbF5StFapYj1 |
| T-PREFAB-03 stash-hut | **票清 ✅（2026-11-13）** 一笔 7107464（js+84/−4 全为头注释零行为删 · test+242/−0 纯追加，本岗 numstat/diff 双核）；票主回执齐：红自证 38/32/6、绿①如实上报半成品未 commit、裁决 1 项（faces 表笔误票主亲修，评审复核确非弱化）、lint 零错、全量 1796/0/1skip（票外既有）；评审两轴通过零必须修，3 建议项挂账（见环境事件），红线「不复用 stilt-hut」核过 | tdd-engineer ses_e2d7321e6ffe4jNQToTg98z770（绿① ses_e2d6c56ffffeepI94JmwhIv6W5 未 commit → 绿② ses_e2d628447ffes2nPGW1yRMT1tP） | commit 7107464；评审 ses_e2d41029bffeRsfHvCegFuSL3z |
| T-PREFAB-04 windmill-tower | **已派（2026-11-13）** 派令含沉淀口径+新通信规程 | tdd-engineer（新起） | spec §4.4；sailStatic 默认 true/叶片展向入 footOf/朝向变体 |
| T-PREFAB-05..08 | 未派（串行：同文件冲突） | — | — |
| T-PREFAB-09 复用行校验 | 未派（依赖 01..07） | — | 收口账（reviewer 备注转入）：①GLOSSARY「蓝图件库」词条与 town-prefab-specs §2.3 基底表仍列三行，M0 收口时随全量新行刷新；②T-02 评审 #1：pfMerge 枚举校验连（piles/roof/torch/torches/windowGlow/signVariant/roofPitch，T-03 后已七连，js/prefab-kit.js:122-151）已达 §1.10 升格线，收口时评估表驱动收编 |
| T-MAP-01..04 | 阻塞（依赖 prefab 线） | — | — |
| T-UI-00 入口卡 token | **已收口 ✅（2026-11-13 本岗验收通过）** | PO→scrum-master 安排；ui-designer ses_e2f96f8dfffevaYWQWoz2NB45z 执行；analyst-manager 需求线审核 | commit d412cff；回执 .scratch/handoffs/2026-11-12-T-UI-00-receipt.md（已归档提交）；验收依据=派单 brief 验收项齐备（路径/对齐说明/lint/conventions/commit），conventions 既有失败与本票无关且已由本岗修复 |
| T-UI-01..05 | 阻塞（T-MAP-02 等；ui-designer 路标票按 PO 指示走提票→scrum-master 安排线） | — | — |

## 环境事件与处理

- 2026-11-13：**T-PREFAB-03 评审挂账（3 条全建议级，零阻断）**：①回执「四探针」实为 6 探针且强于所述——纯措辞偏差，本岗知悉不入账；②door 极性跨行相反（stilt-hut true=敞开 vs stash-hut true=门叶在位，spec 未定极性、两行注释各自自洽）与 ③metalAccent「注入可选」读法下无配件不可表达（注入 0=前墙掏 1×1 墙洞）→ 均**并入 PO 最终验收知情批次**；另评审发现 §4.3「高 5-6=含 dy0 总层数」与 §4.2「高 7=dy 至 7」计数口径不对称（文档级瑕疵）→ 归 PO 勘误线。若 PO 翻转 door 极性：改令 T-03 行走一轮红绿（改动量小）；若维持现状：两行注释互相点名一句即可（票内注释级微改）。
- **PO 最终验收知情批次累积**（不逐项打扰，收口时一揽子）：§4.1 塔身 5×5→4×4 勘误（T-01）· U1-U3（T-01）· T-02 #4 浅色内衬不可达/#5 前檐布幔 vs 陶橙/#6 ASCII 门洞示意矛盾 · T-03 door 极性/metalAccent 墙洞后果/高度计数口径不对称。

- 2026-11-13：**T-PREFAB-02 评审挂账（6 条全建议级，零阻断）**：#1 pfMerge 表驱动→入 T-PREFAB-09 收口账；#2 GLOSSARY 三行过期→已入 T-09/M0 收口账；#3 onRing corner 冗余→不修（自文档化无害）。转需求线知悉（并入 PO 最终验收批次）：#4 doorOpen 仅空气/补墙两档，spec L118「浅色内衬」括注在 v 面不可达（建议性措辞，不判冲突）；#5 前檐=awning 奶油布幔 vs visual §7.2「陶橙前檐」弱张力（§4.2 ids 表支持现实现，注入陶橙即可改观感、几何零动、测试不红）；#6 visual §7.2 ASCII 前视图门洞画 2 行（y1..y2）与 prose/§4.2「2w×3h」示意矛盾，实现按 prose 落地正确（勘误同 §4.1 口径）。

- 2026-11-13：**T-PREFAB-01 spec 歧义裁决（PO-pending）**：reviewer 发现 town-prefab-specs.md §4.1 塔身文面自相矛盾（「5×5 主体」vs「6×6 内缩 1 圈=4×4」，且偶宽 6×6 与奇宽 5×5 无法同心）；ask_user 报 PO（600s）超时未答复 → 按预批编排落推荐默认**② 4×4 同心**（登记裁决，可推翻）；spec 文本未动，勘误一行（5×5→4×4）挂待 PO 确认后由需求线落。若 PO 推翻选 5×5：改令走一轮红绿（几何+测试，改动量小）。

- 2026-11-12：subagent(architect) 权限被拒 → ask_user → 用户修复后重试成功。
- 2026-11-12：subagent(ui-designer) 权限被拒 → ask_user → PO 拍板「提票出来，scrum-master 安排」→ UI 线改走派单 brief（.scratch/handoffs/2026-11-12-T-UI-00-dispatch-brief.md，commit 573668f）。
- 2026-11-12：PO 过目架构（ask_user 900s）超时 → 按预批 A→B→C 落默认记录继续（.scratch/handoffs/2026-11-12-town-phaseB-po-timeout.md）。
- 2026-11-13：Phase A 文档文本卫生修复（commit 045f167）：town-prefab-specs.md 补收尾换行（基线 d0a2725 即缺）、town-ui-dialog-spec.md 统一 LF；minecraft-movie-town-research.md 为检出态 CRLF（blob 本就 LF，工作区对齐即消，无需提交）。conventions.test.js 9/9 绿。**retro 候选：Phase A 文档提交未跑 npm test（conventions 门禁本可拦住）。**

## 流程口径（本批）

- **【规程变更 2026-11-13，PO 指令】废弃 relay escalate 线**：子 Agent 有问题不 escalate 阻塞等待——直接结束运行并把问题写进最终反馈（完成返回即达 engineer-manager）；本岗做出裁定后 sessionID 续令（continue 原 session）把答案带回原子 Agent。所有后续派令写明此规程。背景：relay daemon 工具注册不稳定（check_escalations 报 unknown tool），PO 明确改线。
- prefab 线：一票一收口串行（同文件冲突 + 全量测试证据纯净性），收口顺序 T-PREFAB-01→02→…→09。
- UI 线：ui-designer 路标票由本岗提派单 brief → PO 转 scrum-master 安排 → 回执归本岗验收收口；「ui-designer 走查记录」验收项在实现票阶段由 PO 验收时履行或另行安排。
- 每票收口：证据（红测清单/转绿轨迹/裁决/lint+test/commit）齐备才并入；reviewer 评审在代码票收口后进行（docs-only 票以确定性门禁+需求线审核等效覆盖）。
