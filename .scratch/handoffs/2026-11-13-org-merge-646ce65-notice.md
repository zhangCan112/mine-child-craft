# 通报：主线 fix(agents) 已并入 town-design（merge commit 1486c62）

> 链路：主线 646ce65 → PO 要求合并 → scrum-master 执行（2026-11-13）→ 本 note（engineer-manager / 各线知悉）

## 变更内容

**TDD 主人派下游改前台阻塞派发（修「主提前下线」断链，存活态机制入文）**，涉及三个岗位定义：

- `tdd-engineer.md`：派绿（implement-engineer）一律**前台阻塞**（不带 background）——主挂着的派绿调用就是本岗存活态；绿结束运行（完工回执或提问）调用才返回，主接着验收/裁定，链不断。一票一岗无并行下游，前台等待零代价。
- `bug-doctor.md` / `wayfinder.md`：同口径措辞对齐。

## 生效口径

- 合并（1486c62）**之后新起**的 tdd-engineer / bug-doctor / wayfinder：自动按新定义执行，派令无需额外说明。
- **合并前已在飞**的旧主/旧绿（如 T-07 收口链）：按旧规跑完即可，收口流程不受影响；不必中途改规程。
- engineer-manager 本岗定义本轮无变化，派令纪律照旧（background=true 派主）。

## 附带提醒

- T-PREFAB-08 裁决（推迟）见同目录 `2026-11-13-po-t-prefab-08-ruling.md`，请归台账。
