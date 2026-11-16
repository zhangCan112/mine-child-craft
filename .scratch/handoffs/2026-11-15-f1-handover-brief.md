# F1 移交简报（engmgr-ambition → engmgr-town-boundary · 2026-11-15）

> 接 scrum-master 裁决执行序列②。工作区定稿信号已含——新 F1 主可据此建票接手。配套文档：派令归档 `2026-11-15-f-batch-ambition-dispatch-archive.md` · 复盘文 `2026-11-15-f1-dispatch-retro.md`（同目录）。

## 0. 一句话现状

F1 在制品以**工作区未提交形态**定稿冻结于主 worktree（`C:\Users\user\.local\share\opencode\worktree\1631a8\town-boundary`，分支 town-boundary，基床 tip 已前移至 `e98ba3c`——上游设计定稿批次，纯 docs 零 js/test，与 8 文件在制品零冲突）；全量门自测过：**2125 测 2124 绿 0 红 1 skip（存量 env 门控）+ lint 零错**；零 commit 零还原零续写，验收裁定权在你线。

## 1. 会话与角色

| 角色 | sessionID | 状态 |
|---|---|---|
| F1 主（tdd-engineer） | ses_e20d18b6fffelKH8DIl6q7NLOY | 已停手（终版停手边界执行完毕，回执已出） |
| F1 绿（implement-engineer） | ses_e20c61224ffeOC1dwWD4wD2TaQ | 完工 |

（scrum-master 裁决已确认 sessionID 平移不可行，以上仅备档。）

## 2. 红测试清单（3 文件锚点面 · 红态自证齐全）

| 文件 | 红态 | 红因（实测） |
|---|---|---|
| `test/adventure-core.test.js` | 2/123 红 | 门楼侧柱下格 `5 !== 13`（advEdgeEastSign 仍 v1 牌坊）；门楼柱列在保 false（x156 分支仍 v1） |
| `test/blocks-fields.test.js` | 25/25 红 | `ReferenceError: B_ROOF_TILE is not defined` |
| `test/texture-atlas.test.js` | 24/24 红 | 同上 |
| （语义换轨锚）：`:1170` 开关门控 / `:2959` 收编抽样 | 绿前绿后皆绿 | 采样格改门额 yb+5，load-bearing，不改则绿后必红 |

红因全部可追溯到票面缺口，无实现侧误伤。**红测试先行属实**。

## 3. 转绿状态与改动面（8 文件）

实现面四文件（绿方）：`config.js`（id79 B_ROOF_TILE 纯色行 / id80 B_GATE_SIGN `thin:0.15 solid:true gateSign:true`，均无 hard 零 drop）→ `texture-atlas.js`（T_GATE_SIGN=60 逐像素直译 + T_GATE_WOOD=61 纯木底【design-lead 预授权】，count=62，`back` 新分面字段）→ `mesh-core.js`（pushGateSign 竖板专用小盒：贴西缘/西面满幅/五面木底/自身格光/脚下 solid 剔底面）→ `adventure-core.js`（advEdgeEastSign 按 v2 §3 全量重建 + advEdgeProtectedAt x156 按 §8.1 重写）。

测试面三文件（主红方产物，绿方零触碰）：锚点面如上表；含主亲改两处裁决修正（详见 §4）。

第 8 件：`docs/design/town-east-boundary-landscape-spec-v2.md` 10 行改动——**非本票链产物**（F4 灯柱柱基口径/`:415` 集成口径预告 10→23/§9 体量 +180→+203），判定为你线/设计线并发改稿，F1 未依赖未触碰，归属你线对账。

## 4. 主未写入代码的知识（契约细节/坑）

1. **跨 realm `deepStrictEqual` 原型死锁**：`test/blocks-fields.test.js:137` 断言 config 常量跨 vm realm 必死（独立最小复现坐实）→ 用 `deepEqual`（同文件 `:405` 先例）。
2. **mesh 测试垫块 id 语义**：图集格位测试垫块 id 集走图集通道，横梁语义 13（石砖）不在集——垫块 id 笔误 3→13 已修。
3. **绿方两处偏离已裁定接受**：adventure-core 数字字面量 80/79（测试 require 域常量对实现不可见）；PAINTERS 排版过 lint（注释留档）。
4. **`:2855` T7 性能门 skip**：存量 env 门控（T7_PERF=1 才跑），红态期即存在，非本票引入——别误判为绿方漏测。
5. **`:415` 花田锚将来要改稿**：spec v2 并发改稿已预告合并终值 23（F2/F4 落地后），本票期内 10 丛口径实测绿成立。
6. **S2 直译证据链已在测试面**：texture-atlas.test.js 含像素直译锚点（色板五色锚/色数恰 5/全不透明/61 平涂）——你线的 design-lead 补充验收项（S2 直译 diff）可直接复用该文件跑证。
7. **基床前移**：`e98ba3c`（纯 docs）已在你线时序内落，F1 在制品基于旧基床工作区但零文件冲突，建票时按你线分支纪律处置即可。

## 5. 硬红线亲证（自测时点）

触发线 x≥157∧z74~75 / 回家锚 / 翻越彩蛋 / 白闪 / 话术 / ProtectedZone east 恒 false——diff 关键词 grep 零命中；advEdgeEastFence/advEdgeEastSkyline（F2/F3 面）零改动原绿；零改动锚点（`:804` 两次建场一致 / `:415` 花田 10 丛）在位且绿。

## 6. TDD 走法真实情况自述（主亲证）

- 红测试先行落盘：属实（红态自证见 §2，红先于绿方施工存在）；
- 绿方零触碰 test 面：属实（绿方改动限实现四文件；test 面三文件全部为红方产物+主两处裁决亲改）；
- 绿方打回记录：×2（均主亲证后修测试、不动实现）——裁决记录见 §4.1/4.2。
