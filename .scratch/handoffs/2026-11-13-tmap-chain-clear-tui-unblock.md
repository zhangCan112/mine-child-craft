# T-MAP 链全清 · T-UI-01 解阻通知（engineer-manager → scrum-master，2026-11-13）

## 结论
T-MAP-04 票清（评审两轴 PASS-with-advisory，blocking 0）。**T-MAP 链 01-04 全清，T-UI-01 最早可开工条件（T-MAP-02✅+T-MAP-04✅）满足，即刻解阻**——实现动工排产归你，回执归 engineer-manager 验收收口（既有口径）。

## T-MAP 链票清台账（供消费）
| 票 | commits | 评审 | sessionID |
|---|---|---|---|
| T-MAP-01 布局核心 | 68a8a5f+bff4cff | CONDITIONAL(无码修)+PASS，advisory 已路由 | 主 ses_e2bd3a25cffehrlnK4j59KtXaf |
| T-MAP-02 模式骨架 | 5cb6297 | 规格 PASS+标准 PASS，零必须修 | 主 ses_e2b748ec9ffe5H0EOtudlGvOmb |
| T-MAP-03 场景拼装 | d940764 | PASS-with-advisory，blocking 0 | 主 ses_e2b37fa52ffe7AYcXs2wcvdOF2 |
| T-MAP-04 交互锚点 | b1cd07e+b32b7fb | PASS-with-advisory，blocking 0 | 主 ses_e2ac7bb5dffeEF4uEoPjpt823m |

全量门禁现状：npm test 1893 tests / 1892 pass / 0 fail / 1 skip（票外既有豁免）· lint 零错 · server 门禁显式端口+内容级校验通过。

## T-UI 实现线解阻状态（依 brief 最早可开工条件）
- **T-UI-01：解阻**（T-MAP-02+04✅）——入口 HUD 容器/状态机/提示卡/TTS 重播接线/T-MAP-04 适配层（消费 A-01 定稿协议，见下）。
- T-UI-02：待 01；T-UI-03：待 01；T-UI-04：待 01+03；T-UI-05：待 01..04（联调段按票面另挂起）。

## A-01 协议定稿（T-MAP-04 主回执销号表，实现适配层以此为准）
①事件载体=返回值 events 数组+emit 注入双面（本仓无事件总线）②目标 id=注册表统一、**恒等锚 id**（`bell-tower` 继承 TOWN_MAP.anchors 拼写；iconKey 保留资产键分工）③NPC 动态锚点本票全静态、重发节奏归村民接线票（PO-pending）④无目标=focus(null)→{target:null}，不设 clear ⑤taskRef=`task:` 前缀裸 id、恒等条目 id。协议本体落 `js/town-interact-core.js`（TOWN_UI_EVENTS/TOWN_INTERACT_KINDS/TOWN_SESSION_KINDS 冻结常量+townTargetOf 六键+mkTownTargets 状态机），B 侧 sessionKind 五值已冻结（N4 销号）；`town-ui/dialog/*` 为唯一权威事件名（`town:dialogue:*` 系 dialog-spec 文内旧名，勘误归 PO 勘误线）。

## 随行备忘
- SA-2（T-UI-01 顺带）：js/town-interact-core.js `mkTownTargets(opts)` 对 opts 缺参无守卫——签名契约已在头注释文档化，适配层接线票可顺带补。
- SA-1（读法备忘）：town.js:133 装载容差守卫是生产码层永久容差，勿与装具层红期容差（有过期条款）混读。
- 清理票候选累积（不阻塞）：townAssemblyPhases 摘除 / 旧测块②「双 script」标题正名 / GLOSSARY 一览计数校准（65 声明/66 实数，基线即有）。
- PO-pending 累积见台账知情批次（樱花冠=红羊毛 16 近似、NPC 站位锚点归村民票等），收口时一揽子请 PO 验收。

——engineer-manager（town-design worktree，分支 town-design @ b32b7fb）
