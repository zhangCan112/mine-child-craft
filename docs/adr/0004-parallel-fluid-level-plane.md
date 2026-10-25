# ADR 0004 · 液体水位存并行平面而非扩方块 id 段

日期：2026-10-25 · 状态：已采纳（液体系统，docs/liquid-design.md D2）

## Context

MC 液体的每格状态是 `{源?, 水位 0–8}`（研究稿 §2.5，26.4 官方已收敛为此最小形态）。本仓体素
数据是单一 `worldCells: Uint8Array`（每格一个方块 id ≤255），没有方块元数据层。引入水位必须
决定状态放哪。候选：

- **A. 并行水位面**：`fluidLv: Uint8Array` 与 worldCells 同布局同下标；id 恒 B_WATER/B_LAVA。
- **B. 扩 id 段**：仿基岩版，水/岩浆各占 9 个 id（源 + 0–7 + 下落），水位编码进 id 本身。

## Considered Options

**A. 并行平面（采纳）**
优点：全仓 40+ 处 `id === B_WATER` 判等零改动（探险湖/池塘/纹理/碰撞/raycast 全部继续成立）；
id 语义不稀释——「B_WATER 就是水」不需要每处先归一化；存档只加一层不改一层（edits 值形状
`number | {id, lv}`，旧档零迁移）；后续若有第二种带状态方块（部分损毁等）有先例可循。
代价：pack 跨线程契约要加 levels 通道（mesh-worker 协议与主线程兜底同步扩一次）；
非流体格的 lv=0 写纪律要守卫。

**B. 扩 id 段（否决）**
优点：零新数组，pack 协议不动。
缺点：所有既读 `id===B_WATER` 的调用点（40+）都要改成「id ∈ 水段」——一次全仓审计且易漏；
BLOCKS 表要为 18 个变体 id 复制定义（或运行时合成，注册表纯数据纪律破例）；
颜色/贴图/掉落表全按 id 索引，变体 id 处处要映射回基准 id；存档旧值 24 要迁移到新段语义。

## Consequences

- `fluidLv` 是世界数据的一部分：`world.clear()` 连带清；`packChunkData` 打包 levels；
  存档 edits 值扩 `{id, lv}`（fluid-core 写格经 world.js 统一通道，双写 id+lv）。
- 「非流体格 lv 恒 0」进入 world-integrity 不变量测试。
- 本 ADR 的不可逆点：存档值形状与 pack 契约一旦落盘即成格式承诺；若未来改回 id 段需写新 ADR 并带存档迁移。
