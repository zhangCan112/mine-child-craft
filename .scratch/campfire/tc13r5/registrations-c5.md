# T-C13-R5 c5 登记面（不改产品/史）

日期：2026-11-23 · 票：篝火 T-C13-R5（装配对账+台账重放恢复+守门收口）· 红方Owner 登记落笔

## 登记 1：ab2e652 提交消息含 `~`（史注，不改史）

- 事实：`git log --format=%s -1 ab2e652` 实读含「宽已锁 0.35 又以宽判高 0.4~0.5 无解」（`0.4~0.5` 波浪号）——conventions §7.3「git 提交消息避免 `~` `#` em-dash（扫描器拒）」的违例实例。
- 处置：提交消息是历史不可改写（存档纪律）；本文件+回执双登记，后继提交消息纪律照 §7.3 执行（R5 全部提交消息已自检零 `~` `#` em-dash）。

## 登记 2：test/effects-campfire-sheet.test.js 命名偏离 §1.9 镜像默认（登记表落笔）

- 事实：js/effects.js（无后缀 adapter）的直测文件名 `effects-campfire-sheet.test.js` 非 `effects.test.js` 镜像——§1.9 「adapter 不强制直测：要直测就先剥 -core」的例外形态（sheet 段专测，段级拆名）。
- 核对：测试文件头注释已写明对应模块（「js/effects.js campfireField 场内共享 sheet 守门测试」）——§1.9 「不改名，测试头注释写明对应哪个模块文件」惯例满足；但 §1.9 存量偏差清单未收录（R-4 落文件时漏登记）。
- 处置：docs/conventions.md §1.9 存量命名偏差清单补录 `effects-campfire-sheet`（本次落笔）。

## 附：D 项对账声明（ADR-0020 授权链接续）

R-4 施工时 docs/adr/0020 在途（码内前向引用）；现 ADR 已入册（d136ed9）。码内引用核对：
- js/mesh-core.js 头注「ADR 0020 静态驻 chunk 批」↔ docs/adr/0020-campfire-static-chunk-batch-and-flame-sheet.md Consequences ✓
- js/effects.js 焰片段「静态部件驻 chunk 批(ADR-0020)」+「membership 只吃 fx open 格」↔ ADR Consequences「焰片生命周期归属」条款 ✓
- js/texture-atlas.js 「接线 R-2 已落(81/82 部件表)」↔ ADR「图集接线与存档纪律延续」条款 ✓
- test/texture-atlas.test.js 几何不变量段「ADR-0020 拾取配套」↔ ADR Consequences「拾取政策」条款 ✓
链接续完成，非改动项（回执声明即可，零码改）。
