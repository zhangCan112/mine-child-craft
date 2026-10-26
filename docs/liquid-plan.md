# 液体系统 · 计划稿（liquid-plan）

> 调研底座：[mc-liquid-research.md](mc-liquid-research.md)（MC 一手机制，S1–S17 逐条可溯）。
> 设计定稿：[liquid-design.md](liquid-design.md)。结构决策：[adr/0004-parallel-fluid-level-plane.md](adr/0004-parallel-fluid-level-plane.md)。
> 范围拍板（2026-10-25 与用户逐题共识，Q1–Q24）：水+岩浆全量、MC 参数表模型、
> 进场全场激活、溺水照抄 MC（危险意识）、并行水位面、无限水开、冲毁 thin、
> 部分高度水面、一期实体物理只做玩家。

## 阶段拆解

| # | 阶段 | 内容 | 验收 |
|---|---|---|---|
| P0 | 文档 | 本计划 + 设计定稿 + ADR 0004 | 三份落盘 |
| P1 | 数据层 | config.js：`FLUIDS` 参数表（水/岩浆各一行）+ `FLUID` 全局段 + BLOCKS 挂 `fluid` 旗标；voxel.js：并行水位面 `fluidLv`（Uint8Array，与 worldCells 同布局）+ `getFluidLv/setFluidLv` + `world.clear` 连带清 + `packChunkData` 加 levels 通道（跨线程契约扩一维） | 既有单测全绿（pack 契约向后兼容：无 levels 消费方按源处理） |
| P2 | 纯核心 | `js/fluid-core.js`：计划刻步进 / 水位重算 / 坡向寻路 / 下落优先 / 源再生 / 水岩混合 / 冲毁 thin——read/write 全注入（cascade-core 同款契约），队列排程序驱动（零墙钟） | `test/fluid-core.test.js`：传播 7 格菱形、坡向收束 1 格宽、下落重置距离、断供消退、无限水两规则、混合三规则、冲毁、确定性（同编辑序同终态） |
| P3 | 装配 | world.js：sim 实例 + `editBlock/editBlockDirty` 挂 notifyEdit（破坏/放置邻接即排程）+ `pumpFluids(dt)`（20tps 累积，每帧 128 格预算）+ `activateFluids()`（loadScene 收尾同步结算，上限 20 万格）+ 事件分发（markDirty/sfx/掉落/journal sink）+ `setFluidEditSink(fn)` seam | 手玩：挖湖岸水流出、挖穿熔岩池壁岩浆缓漫 |
| P4 | 渲染 | mesh-core：流体通道几何（顶面 y=amount/9、上方有同流体=整格、侧面部分高度、同流体相邻剔面、不透明邻块剔面）——水入 glass 通道、岩浆入 solid 通道；mesh-worker 协议加 levels；pack 契约单测同步 | 湖面低 1/9、水流坡面可见、瀑布整格柱 |
| P5 | 物理 | voxel.js physics：水内分支（半速/缓沉/跳浮/入水缓降=免摔伤）、岩浆分支（×0.5/×0.8 阻尼）、水流推力（水位梯度向量，1.39 格/秒）、气泡计时（15s→每秒 2 伤事件）+ 岩浆接触（每 0.5s 4 伤事件）——伤害经 worldEvents 事件出，结算在模式层 | 探险跳湖：缓沉、跳键上浮、出水复原 |
| P6 | HUD+音效 | audio-registry：复活 `splash` + 新增 `lava_hiss`（synth 回退）；mode-kit：`mkBubbleBar`（10 泡像素条挂快捷栏上方 + 剩 3 泡 TTS 一次性提醒，节流自持） | 入水水花声、气泡条走字、TTS 提醒恰一次 |
| P7 | 模式接线 | 建造调色板加水/岩浆源两槽；build/adventure 存档值扩 `{id, lv?}`（旧档数字向后兼容：24/25 → 源）+ 流体写经 sink 入账 + 重放写双通道 + init 注册 sink；探险/下界 update 消费 drownTick/lavaTick 事件结算 HP | 重进世界水位精确复现；建造摆水即流 |
| P8 | 收尾 | world-integrity 流体不变量（终态无孤儿流动块/无越界水位）；boot 冒烟（fluid-core.js 进 index.html 加载序）；GLOSSARY 词条；`npm test` + `npm run lint` 全绿 | 全部测试与 lint 零错误 |

## 依赖序

P1 → P2 →（P3、P4 可并行，都要 P1 契约）→ P5 → P6 → P7 → P8。
P3 先于 P4（装配定事件面，渲染只吃 levels 通道）；P5 依赖 P3 的世界态但物理分支独立可测。

## 风险登记

- pack 跨线程契约扩维：mesh-worker 协议与主线程兜底同改（test/mesh-worker.test.js 锁协议，须同步扩）。
- 既有 mesh 断言：水从整格变 8/9 高度，mesh-core.test.js 相关断言按新契约更新（行为变更是设计决定，Q9）。
- 存档兼容：edits 值形状 number→number|{id,lv}，两模式 decode 兼容旧档；写档路径全走同一 encode。
- 性能：坡向寻路最坏 4×3⁴≈324 读/格，预算 128 格/帧封顶；装场同步结算设 20 万格上限。
