# 并版收口回执 — 滑翔翼特性 glider → main（2026-11-16）

## 合并
- 并版提交 **a402a19**（merge：689d246 glider 侧 × 342704c main 侧），main 快进至 7532b19（诊断归档+日志保全簿记）。
- 谱系：T-G01–T-G08 八票（2b09379…ef0a1e4）+ v1.2 规格迭代（deecefb）+ PO 两刀调参（sink 终值 −1.2）+ 收口微扫（b463178）+ 需求线 spec 记账（689d246）；PO 实机终验通过（8081 两轮实飞后拍板）。

## 冲突和解（2 处，均机械）
1. js/modes/adventure.js 蓄力行：滑翔暂停守卫（T-G04 R1-18）×镇傀儡瞄准豁免（PO 案④）双授权面并集——`hit && !advGlideOn() && !advTownAimBlocked()`。
2. test/adventure-mode.test.js EOF：glider 尾块（T-G01–T-G05）×villager/po-accept 尾块依序共存（顶层声明两线零交集，预检实证）。

## 跨线装具互作用修复（bug-doctor 诊断，合并内修复）
- 根因：`T-G04 死亡重生`测试残留引擎 gliding 态（cleanup 卸装备后零物理帧，voxel.js 收翼系帧级判定）×glider 尾块 `globalThis.isGliding` 桥接不撤 → 全量跑序中 `advGlideOn()` 恒真 → main 侧 PO④-2/3 蓄力测试误判不起。main 单独绿（无桥接件）/glider 单独绿（尾块后无挖掘消费）。
- 修复：freshInit 统一复位姊妹件 `glideHygiene()`（纯装具面 ~17 行，镜像浏览器卸翼一帧，零断言改动、零行为面触碰）。诊断全文 .scratch/glider/receipts/merge-bug-diagnosis-receipt.md。

## 门禁三关（全绿）
| 时点 | 树 | 数字 |
|---|---|---|
| 合并前 | glider@689d246 | 2196/2195/0/1 + lint 零错 |
| 合并态 | a402a19（worktree） | 2266/2265/0/1 + lint 零错 |
| 并版后终门 | main@7532b19（本仓库亲测） | **2266/2265/0/1 + lint 三关零错** |

新基数 2266 = glider 2196 + villager-wave2 批净增 70。
